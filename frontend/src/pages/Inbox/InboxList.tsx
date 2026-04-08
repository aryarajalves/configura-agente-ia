import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useNavigate } from 'react-router-dom';

interface InboxItem {
    id: string;
    pergunta_usuario: string;
    resposta_ia: string;
    motivo_falha: string;
    frequencia_erro: number;
    status: string;
}

const InboxList = () => {
    const [items, setItems] = useState<InboxItem[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchInbox();
    }, []);

    const fetchInbox = async () => {
        try {
            const response = await api.get('/v1/inbox/');
            setItems(response.data.data);
        } catch (error) {
            console.error('Error fetching inbox', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-6">Carregando Inbox...</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Inbox de Dúvidas (Curadoria)</h1>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                    {items.length} Falhas Agrupadas
                </span>
            </div>

            <div className="grid gap-4">
                {items.map(item => (
                    <div
                        key={item.id}
                        onClick={() => navigate(`/inbox/${item.id}`)}
                        className="bg-white border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex justify-between items-center"
                    >
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">
                                    {item.motivo_falha || 'Falha Detectada'}
                                </span>
                                <span className="text-xs text-gray-500">
                                    Frequência: <span className="font-bold text-gray-800">{item.frequencia_erro}x</span>
                                </span>
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-1">"{item.pergunta_usuario}"</h3>
                            <p className="text-sm text-gray-600 truncate max-w-2xl">
                                IA respondeu: {item.resposta_ia}
                            </p>
                        </div>

                        <div className="ml-4">
                            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium">
                                Revisar
                            </button>
                        </div>
                    </div>
                ))}

                {items.length === 0 && (
                    <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed">
                        <p className="text-gray-500">Nenhuma falha pendente de revisão. Bom trabalho!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InboxList;
