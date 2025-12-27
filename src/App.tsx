import { useEffect, useCallback, useMemo } from "react";
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

import DeviceNode from "./components/DeviceNode";
import AppNode from "./components/AppNode";

interface AudioDevice {
  name: string;
  device_type: "Input" | "Output";
}

interface AppSession {
  pid: number;
  name: string;
  volume: number;
  is_muted: boolean;
}

export default function App() {
  const nodeTypes = useMemo(() => ({ 
    device: DeviceNode,
    app: AppNode 
  }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  useEffect(() => {
    async function loadEverything() {
      const devices = await invoke<AudioDevice[]>("get_audio_devices");
      
      const apps = await invoke<AppSession[]>("get_audio_sessions");

      const loadedNodes: Node[] = [];

      devices.forEach((dev, index) => {
        const isInput = dev.device_type === "Input";
        
        const xPos = isInput ? 0 : 900;
        const yPos = index * 160 + 50;

        loadedNodes.push({
          id: `dev-${dev.name}-${index}`,
          type: 'device',
          data: { 
            label: dev.name,
            deviceType: dev.device_type 
          }, 
          position: { x: xPos, y: yPos },
        });
      });

      apps.forEach((app, index) => {
        loadedNodes.push({
          id: `app-${app.pid}`,
          type: 'app',
          data: { 
            label: app.name,
            pid: app.pid,
            initialVolume: app.volume
          },
          position: { x: 450, y: index * 160 + 50 },
        });
      });
      
      setNodes(loadedNodes);
    }

    loadEverything();
    const interval = setInterval(loadEverything, 5000);
    return () => clearInterval(interval);

  }, [setNodes]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        colorMode="dark"
        fitView
      >
        <Background color="#111" gap={30} />
        <Controls />
      </ReactFlow>
    </div>
  );
}