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
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./App.css";
import DeviceNode from "./components/DeviceNode";

interface AudioDevice {
  name: string;
  device_type: "Input" | "Output";
}

export default function App() {
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
        
        const xPos = isInput ? 100 : 600;
        const yPos = index * 150 + 50;

        return {
          id: `${dev.device_type}-${index}`, 
          type: 'device', 
          data: { 
            label: dev.name,
            deviceType: dev.device_type
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
        nodeTypes={nodeTypes}
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