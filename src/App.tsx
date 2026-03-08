import { useState, useEffect, useCallback, useMemo } from "react";

import { invoke } from "@tauri-apps/api/core";
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Connection,
  Node,
  Edge,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./App.css";
import DeviceNode from "./components/DeviceNode";

interface AudioDevice {
  name: string;
  device_type: "Input" | "Output" | "App";
}

export default function App() {
  const [isGrouped, setIsGrouped] = useState(true);

  const nodeTypes = useMemo(() => ({ device: DeviceNode }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    async (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));

      try {
        const resposta = await invoke("connect_audio_stream", {
          inputDevice: params.source,
          outputDevice: params.target
        });
        console.log("Sucesso:", resposta);
      } catch (error) {
        console.error("Erro ao ligar os dispositivos:", error);
      }
    },
    [setEdges],
  );

  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      edgesToDelete.forEach(async (edge) => {
        try {
          await invoke("disconnect_audio_stream", {
            inputDevice: edge.source,
            outputDevice: edge.target
          });
          console.log(`Desconectado: ${edge.source} -> ${edge.target}`);
        } catch (error) {
          console.error("Erro ao desconectar:", error);
        }
      });
    },
    []
  );

  useEffect(() => {
    async function setupDevices() {
      const devices = await invoke<AudioDevice[]>("get_audio_devices");
      const activeApps = await invoke<string[]>("get_active_apps");
      
      const inputs = devices.filter((d) => d.device_type === "Input");
      const outputs = devices.filter((d) => d.device_type === "Output");
      
      const apps = activeApps.map(name => ({
        name: name,
        device_type: "App" as const
      }));

      const newNodes: Node[] = [];

      if (isGrouped) {
        newNodes.push({
          id: 'group-inputs',
          type: 'group',
          position: { x: 50, y: 50 },
          style: { width: 340, height: Math.max(inputs.length * 150 + 50, 200), backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '2px dashed #555', borderRadius: '15px' },
          data: { label: 'Microfones' },
        });
        
        newNodes.push({
          id: 'group-apps',
          type: 'group',
          position: { x: 420, y: 50 },
          style: { width: 340, height: Math.max(apps.length * 150 + 50, 200), backgroundColor: 'rgba(0, 230, 118, 0.05)', border: '2px dashed #00E676', borderRadius: '15px' },
          data: { label: 'Aplicativos' },
        });

        newNodes.push({
          id: 'group-outputs',
          type: 'group',
          position: { x: 790, y: 50 },
          style: { width: 340, height: Math.max(outputs.length * 150 + 50, 200), backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '2px dashed #555', borderRadius: '15px' },
          data: { label: 'Saídas' },
        });
      }

      let inputY = isGrouped ? 25 : 50;
      let appY = isGrouped ? 25 : 50;
      let outputY = isGrouped ? 25 : 50;

      const inputX = isGrouped ? 25 : 50;
      const appX = isGrouped ? 25 : 420;
      const outputX = isGrouped ? 25 : 790;

      const allItems = [...devices, ...apps];

      allItems.forEach((dev) => {
        const isInput = dev.device_type === "Input";
        const isApp = dev.device_type === "App";
        const isOutput = dev.device_type === "Output";

        let xPos = 0; let yPos = 0; let parent = '';

        if (isInput) { xPos = inputX; yPos = inputY; parent = 'group-inputs'; inputY += 150; }
        else if (isApp) { xPos = appX; yPos = appY; parent = 'group-apps'; appY += 150; }
        else if (isOutput) { xPos = outputX; yPos = outputY; parent = 'group-outputs'; outputY += 150; }

        newNodes.push({
          id: isApp ? `[App] ${dev.name}` : dev.name,
          type: 'device',
          ...(isGrouped ? { parentId: parent, extent: 'parent' } : {}),
          data: { label: dev.name, deviceType: dev.device_type },
          position: { x: xPos, y: yPos },
        });
      });

      setNodes(newNodes);
    }

    setupDevices();
  }, [setNodes, isGrouped]);

  const defaultEdgeOptions = {
    style: { strokeWidth: 3, stroke: '#888' },
    interactionWidth: 25, 
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          if (node.type === 'group') {
            setIsGrouped(false);
          }
        }}
        colorMode="dark"
        fitView
      >
        <Background color="#111" gap={25} />
        <Controls />
      </ReactFlow>
    </div>
  );
}