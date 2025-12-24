import { useState, useEffect, useCallback, useMemo } from "react"; // <--- Add useMemo
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
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./App.css";
import DeviceNode from "./components/DeviceNode"; // <--- Importamos nosso componente

interface AudioDevice {
  name: string;
  device_type: "Input" | "Output";
}

export default function App() {
  // Configura os tipos de nós personalizados (useMemo para performance)
  const nodeTypes = useMemo(() => ({ device: DeviceNode }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  useEffect(() => {
    async function setupDevices() {
      const devices = await invoke<AudioDevice[]>("get_audio_devices");
      
      const newNodes: Node[] = devices.map((dev, index) => {
        const isInput = dev.device_type === "Input";
        
        // Posições iniciais
        const xPos = isInput ? 100 : 600; // Afastei um pouco mais
        const yPos = index * 150 + 50;    // Aumentei o espaço vertical

        return {
          id: `${dev.device_type}-${index}`, 
          type: 'device', // <--- MUDANÇA IMPORTANTE: Usamos nosso tipo 'device'
          data: { 
            label: dev.name,
            deviceType: dev.device_type // Passamos o tipo para mudar a cor
          }, 
          position: { x: xPos, y: yPos },
        };
      });
      
      setNodes(newNodes);
    }

    setupDevices();
  }, [setNodes]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes} // <--- Passamos os tipos personalizados aqui
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        colorMode="dark"
        fitView
      >
        <Background color="#111" gap={25} />
        <Controls />
      </ReactFlow>
    </div>
  );
}