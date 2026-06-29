import { Node } from "@xyflow/react";

interface ContextMenuProps {
  menu: { id: string, type: 'instance' | 'category' | 'pane', top: number, left: number } | null;
  setMenu: (menu: null) => void;
  detachNode: () => void;
  nodes: Node[];
  setEditingCategory: (cat: { id: string, label: string, color: string } | null) => void;
  createCategory: () => void;
  separateCategory: () => void;
  deleteCategory: () => void;
  duplicateNode: () => void;
  deleteInstance: () => void;    
  canDeleteInstance: boolean;     
}

const contextMenuButtonStyle = {
  background: 'transparent', border: 'none', 
  padding: '10px 15px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
  borderRadius: '4px', width: '100%', textAlign: 'left' as const
};

export default function ContextMenu({ 
  menu, setMenu, detachNode, nodes, setEditingCategory, 
  createCategory, separateCategory, deleteCategory, duplicateNode, deleteInstance, canDeleteInstance
}: ContextMenuProps) {
  if (!menu) return null;

  return (
    <div style={{
      position: 'absolute', top: menu.top, left: menu.left, zIndex: 1000,
      background: '#1a1a1a', border: '1px solid #444', borderRadius: '8px', padding: '6px',
      boxShadow: '0 8px 16px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: '4px' 
    }}>
      
      {menu.type === 'pane' && (
        <button 
          onClick={createCategory} 
          style={{ ...contextMenuButtonStyle, color: '#00e5ff' }}
          onMouseOver={(e) => e.currentTarget.style.background = '#333'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
          ➕ Criar nova categoria
        </button>
      )}

      {menu.type === 'instance' && (
        <>
          <button 
            onClick={duplicateNode} 
            style={{ ...contextMenuButtonStyle, color: '#00e5ff' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#333'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            📄 Duplicar Instância
          </button>
          <button 
            onClick={detachNode} style={{ ...contextMenuButtonStyle, color: '#ff4444' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#333'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            ❌ Desprender da Categoria
          </button>
          {canDeleteInstance && (
            <button 
              onClick={deleteInstance} style={{ ...contextMenuButtonStyle, color: '#ff4444', borderTop: '1px solid #333' }}
              onMouseOver={(e) => e.currentTarget.style.background = '#333'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              🗑️ Excluir Instância
            </button>
          )}
        </>
      )}

      {menu.type === 'category' && (
        <>
          <button 
            onClick={() => { 
              const catNode = nodes.find(n => n.id === menu.id);
              if (catNode) {
                setEditingCategory({ id: menu.id, label: catNode.data.label as string, color: catNode.data.color as string });
              }
              setMenu(null); 
            }}
            style={{ ...contextMenuButtonStyle, color: 'white' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#333'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            ✏️ Editar
          </button>
          <button 
            onClick={duplicateNode} 
            style={{ ...contextMenuButtonStyle, color: '#00e5ff' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#333'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            📄 Duplicar Categoria
          </button>
          <button 
            onClick={separateCategory} 
            style={{ ...contextMenuButtonStyle, color: '#ff4444' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#333'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            ✂️ Separar
          </button>
          <button 
            onClick={deleteCategory} 
            style={{ ...contextMenuButtonStyle, color: '#ff4444' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#333'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            ❌ Excluir Categoria
          </button>
        </>
      )}
    </div>
  );
}