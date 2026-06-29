import { Node } from "@xyflow/react";

export interface AudioDevice {
  name: string;
  device_type: "Input" | "Output" | "Application";
}

export const initialCategories: Node[] = [
  { id: 'cat-entradas', type: 'category', position: { x: 50, y: 50 }, data: { label: '🎤 Entradas', color: '#2F8CFF' }, style: { width: 340, height: 200 } },
  { id: 'cat-aplicativos', type: 'category', position: { x: 450, y: 50 }, data: { label: '🖥 Aplicativos', color: '#A855F7' }, style: { width: 340, height: 200 } },
  { id: 'cat-saidas', type: 'category', position: { x: 850, y: 50 }, data: { label: '🔊 Saídas', color: '#22C55E' }, style: { width: 340, height: 200 } }
];

export const organizeCategories = (nodesArray: Node[]) => {
  let newNodes = [...nodesArray].sort((a, b) => {
    if (a.type === 'category' && b.type === 'instance') return -1;
    if (a.type === 'instance' && b.type === 'category') return 1;
    return 0;
  });
  
  const categoryIds = newNodes.filter(n => n.type === 'category').map(n => n.id);
  
  categoryIds.forEach(catId => {
    const children = newNodes.filter(n => n.parentId === catId && n.type === 'instance');
    
    children.sort((a, b) => a.position.y - b.position.y);
    
    children.forEach((child, index) => {
      const xPos = 20; 
      const yPos = 70 + (index * 150); 
      
      newNodes = newNodes.map(n => 
        n.id === child.id ? { 
          ...n, position: { x: xPos, y: yPos }, extent: 'parent' 
        } : n
      );
    });

    const dynamicHeight = Math.max(150, 70 + (children.length * 150) + 20);

    newNodes = newNodes.map(n => {
      if (n.id === catId) {
        return { ...n, style: { ...n.style, width: 340, height: dynamicHeight } };
      }
      return n;
    });
  });
  
  return newNodes;
};