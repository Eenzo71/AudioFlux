import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { 
  ReactFlow, Background, Controls, useEdgesState, addEdge, Connection, Node, Edge,
  useReactFlow, ReactFlowProvider, applyNodeChanges, NodeChange
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./App.css";

import DeviceNode from "./components/DeviceNode";
import GroupNode from "./components/GroupNode";
import ContextMenu from "./components/ContextMenu";
import EditCategoryModal from "./components/EditCategoryModal";
import { initialCategories, organizeCategories, AudioDevice } from "./utils";

function Flow() {
  const nodeTypes = useMemo(() => ({ instance: DeviceNode, category: GroupNode }), []);
  const [nodes, setNodes] = useState<Node[]>(initialCategories);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [menu, setMenu] = useState<{ id: string, type: 'instance' | 'category' | 'pane', top: number, left: number } | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ id: string, label: string, color: string } | null>(null);

  const { getIntersectingNodes, screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const nextNodes = applyNodeChanges(changes, nds);
      return nextNodes.map(n => {
        if (n.type === 'instance' && n.parentId) {
          return { ...n, position: { x: 20, y: n.position.y }, extent: 'parent' };
        }
        return n;
      });
    });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    if (node.type === 'instance' && node.parentId) {
      setMenu({ id: node.id, type: 'instance', top: event.clientY, left: event.clientX });
    } else if (node.type === 'category') {
      setMenu({ id: node.id, type: 'category', top: event.clientY, left: event.clientX });
    } else {
      setMenu(null);
    }
  }, []);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setMenu({ id: 'pane', type: 'pane', top: event.clientY, left: event.clientX });
  }, []);

  const createCategory = useCallback(() => {
    if (!menu || menu.type !== 'pane') return;
    const position = screenToFlowPosition({ x: menu.left, y: menu.top });
    const newCatId = `cat-custom-${Date.now()}`;
    const newCategory: Node = {
      id: newCatId, type: 'category', position: position,
      data: { label: 'Nova Categoria', color: '#888888' }, style: { width: 340, height: 150 }
    };
    setNodes((nds) => [...nds, newCategory]);
    setMenu(null);
    setEditingCategory({ id: newCatId, label: 'Nova Categoria', color: '#888888' });
  }, [menu, screenToFlowPosition, setNodes]);

  const detachNode = useCallback(() => {
    if (!menu || menu.type !== 'instance') return;
    setNodes((nds) => {
      const updatedNodes: Node[] = nds.map((n) => {
        if (n.id === menu.id) {
          const parent = nds.find(p => p.id === n.parentId);
          return {
            ...n, parentId: undefined, extent: undefined,
            position: parent ? { x: parent.position.x + n.position.x + 370, y: parent.position.y + n.position.y } : n.position
          } as Node;
        }
        return n;
      });
      return organizeCategories(updatedNodes);
    });
    setMenu(null);
  }, [menu]);

  const separateCategory = useCallback(() => {
    if (!menu || menu.type !== 'category') return;
    setNodes((nds) => {
      const catNode = nds.find(n => n.id === menu.id);
      if (!catNode) return nds;

      const updatedNodes: Node[] = nds.map((n) => {
        if (n.parentId === menu.id) {
          return {
            ...n, parentId: undefined, extent: undefined,
            position: { x: catNode.position.x + n.position.x + 370, y: catNode.position.y + n.position.y }
          } as Node;
        }
        return n;
      });
      return organizeCategories(updatedNodes);
    });
    setMenu(null);
  }, [menu]);

  const deleteCategory = useCallback(() => {
    if (!menu || menu.type !== 'category') return;
    setNodes((nds) => {
      const catNode = nds.find(n => n.id === menu.id);
      if (!catNode) return nds;

      const detachedNodes: Node[] = nds.map((n) => {
        if (n.parentId === menu.id) {
          return {
            ...n, parentId: undefined, extent: undefined,
            position: { x: catNode.position.x + n.position.x, y: catNode.position.y + n.position.y }
          } as Node;
        }
        return n;
      });
      const finalNodes = detachedNodes.filter(n => n.id !== menu.id);
      return organizeCategories(finalNodes);
    });
    setMenu(null);
  }, [menu]);

  const duplicateNode = useCallback(() => {
    if (!menu || menu.type === 'pane') return;

    setNodes((nds) => {
      const nodeToCopy = nds.find(n => n.id === menu.id);
      if (!nodeToCopy) return nds;

      if (nodeToCopy.type === 'category') {
        const newCatId = `cat-copy-${Date.now()}`;
        const newCategory: Node = {
          ...nodeToCopy,
          id: newCatId,
          position: { x: nodeToCopy.position.x + 50, y: nodeToCopy.position.y + 50 },
          data: { ...nodeToCopy.data, label: `${nodeToCopy.data.label} (Cópia)` },
          selected: false,
        };

        const children = nds.filter(n => n.parentId === nodeToCopy.id);
        const newChildren: Node[] = children.map((child, index) => ({
          ...child,
          id: `inst-copy-${Date.now()}-${index}`,
          parentId: newCatId,
          data: { ...child.data, label: `${child.data.label} (Cópia)` },
          selected: false,
        }));

        return organizeCategories([...nds, newCategory, ...newChildren]);

      } else {
        const newId = `inst-copy-${Date.now()}`;
        const newNode: Node = {
          ...nodeToCopy,
          id: newId,
          position: !nodeToCopy.parentId ? { x: nodeToCopy.position.x + 50, y: nodeToCopy.position.y + 50 } : nodeToCopy.position,
          data: { ...nodeToCopy.data, label: `${nodeToCopy.data.label} (Cópia)` },
          selected: false,
        };
        return organizeCategories([...nds, newNode]);
      }
    });
    setMenu(null);
  }, [menu]);

  const deleteInstance = useCallback(() => {
    if (!menu || menu.type !== 'instance') return;
    setNodes((nds) => {
      const finalNodes = nds.filter(n => n.id !== menu.id);
      return organizeCategories(finalNodes);
    });
    setMenu(null);
  }, [menu]);

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type !== 'instance') return;
    const intersections = getIntersectingNodes(node).filter((n) => n.type === 'category');
    const dropZone = intersections[0];
    if (dropZone && !node.parentId) {
      setNodes((nds) => {
        const updatedNodes: Node[] = nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n, parentId: dropZone.id, extent: 'parent',
              position: { x: 20, y: node.position.y - dropZone.position.y },
            } as Node;
          }
          return n;
        });
        return organizeCategories(updatedNodes);
      });
    } else if (node.parentId) {
      setNodes((nds) => organizeCategories([...nds]));
    }
  }, [getIntersectingNodes]);

  useEffect(() => {
    async function setupDevices() {
      const hardware = await invoke<AudioDevice[]>("get_audio_devices");
      const apps = await invoke<AudioDevice[]>("get_audio_apps");
      const allDevices = [...hardware, ...apps];

      const instanceNodes: Node[] = allDevices.map((dev, index) => {
        let parentId = '';
        if (dev.device_type === "Input") parentId = 'cat-entradas';
        else if (dev.device_type === "Application") parentId = 'cat-aplicativos';
        else if (dev.device_type === "Output") parentId = 'cat-saidas';

        const baseId = `inst-${dev.device_type}-${index}`;

        return {
          id: baseId, type: 'instance', parentId,
          extent: parentId ? 'parent' : undefined,
          data: { label: dev.name, deviceType: dev.device_type, baseId: baseId },
          position: { x: 0, y: 0 },
        };
      });

      setNodes(organizeCategories([...initialCategories, ...instanceNodes]));
    }
    setupDevices();
  }, []);

  let canDeleteInstance = false;
  if (menu && menu.type === 'instance') {
    const selectedNode = nodes.find(n => n.id === menu.id);
    if (selectedNode) {
      const count = nodes.filter(n => n.type === 'instance' && n.data.baseId === selectedNode.data.baseId).length;
      canDeleteInstance = count > 1;
    }
  }

  useEffect(() => {
    const activeRoutes = edges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      return {
        source_name: sourceNode?.data.label || edge.source,
        target_name: targetNode?.data.label || edge.target
      };
    });

    invoke('apply_routes', { routes: activeRoutes }).catch(console.error);

  }, [edges, nodes]); 

  return (
    <>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onNodeDragStop={onNodeDragStop} onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={() => setMenu(null)}
        colorMode="dark" fitView
      >
        <Background color="#111" gap={25} />
        <Controls />
      </ReactFlow>

      <ContextMenu
        menu={menu} setMenu={setMenu} detachNode={detachNode}
        nodes={nodes} setEditingCategory={setEditingCategory}
        createCategory={createCategory} separateCategory={separateCategory} deleteCategory={deleteCategory}
        duplicateNode={duplicateNode}
        deleteInstance={deleteInstance}
        canDeleteInstance={canDeleteInstance}
      />
      <EditCategoryModal editingCategory={editingCategory} setEditingCategory={setEditingCategory} setNodes={setNodes} />
    </>
  );
}

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", overflow: 'hidden' }}>
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  );
}