import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Connection,
  Edge,
  Position,
  Node
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./App.css";

interface AudioDevice {
  name: string;
  device_type: "Input" | "Output";
}

export default function App() {
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
        const xPos = isInput ? 50 : 500;
        const yPos = index * 100 + 50;

        return {
          id: `${dev.device_type}-${index}`, 
          type: 'input', 
          data: { label: dev.name }, 
          position: { x: xPos, y: yPos },
          style: { 
            background: '#1a1a1a', 
            color: '#fff', 
            border: isInput ? '2px solid #ff4081' : '2px solid #00e5ff',
            width: 250,
          },
          sourcePosition: isInput ? Position.Right : Position.Right, 
          targetPosition: isInput ? Position.Left : Position.Left,   
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        colorMode="dark"
        fitView
      >
        <Background color="#333" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}