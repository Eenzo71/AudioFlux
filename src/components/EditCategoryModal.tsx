import { Node } from "@xyflow/react";

interface EditCategoryModalProps {
  editingCategory: { id: string, label: string, color: string } | null;
  setEditingCategory: (cat: any) => void;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}

export default function EditCategoryModal({ editingCategory, setEditingCategory, setNodes }: EditCategoryModalProps) {
  if (!editingCategory) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
    }}>
      <div style={{
        background: '#1e1e1e', padding: '24px', borderRadius: '12px', border: '1px solid #333',
        width: '320px', display: 'flex', flexDirection: 'column', gap: '20px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.8)'
      }}>
        <h3 style={{ color: 'white', margin: 0, fontSize: '18px' }}>Editar Categoria</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: '#aaa', fontSize: '13px' }}>Nome da Categoria</label>
          <input 
            type="text" 
            value={editingCategory.label}
            onChange={(e) => setEditingCategory({ ...editingCategory, label: e.target.value })}
            style={{ 
              padding: '10px', borderRadius: '6px', border: '1px solid #444', 
              background: '#111', color: 'white', fontSize: '14px', outline: 'none'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: '#aaa', fontSize: '13px' }}>Cor do Destaque</label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input 
              type="color" 
              value={editingCategory.color}
              onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
              style={{ width: '45px', height: '45px', padding: '0', border: 'none', background: 'transparent', cursor: 'pointer' }}
            />
            <span style={{ color: 'white', fontSize: '14px', fontFamily: 'monospace' }}>
              {editingCategory.color.toUpperCase()}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button 
            onClick={() => setEditingCategory(null)}
            style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#333', color: 'white', cursor: 'pointer', transition: '0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#444'}
            onMouseOut={(e) => e.currentTarget.style.background = '#333'}
          >
            Cancelar
          </button>
          <button 
            onClick={() => {
              setNodes((nds) => nds.map(n => 
                n.id === editingCategory.id 
                  ? { ...n, data: { ...n.data, label: editingCategory.label, color: editingCategory.color } } 
                  : n
              ));
              setEditingCategory(null);
            }}
            style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: editingCategory.color, color: 'white', cursor: 'pointer', fontWeight: 'bold', filter: 'brightness(1.1)', transition: '0.2s' }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}