import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api';

const InboxDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [item, setItem] = useState<any>(null);
    const [suggestion, setSuggestion] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchItem();
    }, [id]);

    const fetchItem = async () => {
        try {
            const response = await api.get(`/v1/inbox/${id}`);
            const itemData = response.data.data;
            setItem(itemData);
            setSuggestion(itemData.sugestao_ia || itemData.resposta_ia || '');
        } catch (error) {
            console.error('Error fetching item', error);
        } finally {
            setLoading(false);
        }
    };

    const resolve = async () => {
        try {
            await api.post(`/v1/inbox/${id}/resolve`, {
                final_response: suggestion,
                apply_to_rag: true
            });
            alert('Resolvido e aplicado ao RAG!');
            navigate('/inbox');
        } catch (error) {
            alert('Erro ao resolver item');
        }
    };

    const discard = async () => {
        if (!window.confirm('Deseja descartar este item?')) return;
        try {
            await api.post(`/v1/inbox/${id}/discard`);
            alert('Item descartado.');
            navigate('/inbox');
        } catch (error) {
            alert('Erro ao descartar item');
        }
    };

    const block = async () => {
        if (!window.confirm('Deseja bloquear este tópico para a IA?')) return;
        try {
            await api.post(`/v1/inbox/${id}/block`);
            alert('Tópico bloqueado.');
            navigate('/inbox');
        } catch (error) {
            alert('Erro ao bloquear tópico');
        }
    };

    if (loading) return <div className="p-6">Carregando...</div>;
    if (!item) return <div className="p-6">Item não encontrado.</div>;

    const isPending = item.status === 'PENDENTE';

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <button
                onClick={() => navigate('/inbox')}
                className="text-blue-600 mb-6 flex items-center gap-1 hover:underline"
            >
                ← Voltar para Inbox
            </button>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-gray-50 p-6 border-b">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                item.status === 'RESOLVIDO' ? 'text-green-600 bg-green-50' : 
                                item.status === 'DESCARTADO' ? 'text-gray-600 bg-gray-50' :
                                item.status === 'BLOQUEADO' ? 'text-purple-600 bg-purple-50' : 
                                'text-red-600 bg-red-50'
                            }`}>
                                {item.status}: {item.motivo_falha}
                            </span>
                            <h1 className="text-2xl font-bold mt-2 text-gray-900">Detalhes da Divergência</h1>
                        </div>
                        <div className="flex gap-2">
                             {isPending && (
                                <>
                                    <button 
                                        onClick={discard}
                                        className="text-xs bg-white border border-gray-300 text-gray-600 px-3 py-1 rounded hover:bg-gray-100 transition-colors uppercase font-bold"
                                    >
                                        Descartar
                                    </button>
                                    <button 
                                        onClick={block}
                                        className="text-xs bg-white border border-purple-300 text-purple-600 px-3 py-1 rounded hover:bg-purple-50 transition-colors uppercase font-bold"
                                    >
                                        Bloquear Tópico
                                    </button>
                                </>
                             )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Pergunta do Usuário</h3>
                            <p className="text-gray-900 bg-blue-50 p-4 rounded-lg border border-blue-100 italic">
                                "{item.pergunta_usuario}"
                            </p>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Resposta Original IA</h3>
                            <p className="text-gray-900 bg-gray-100 p-4 rounded-lg border italic">
                                "{item.resposta_ia}"
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <h3 className="font-semibold text-lg mb-4 text-gray-900">Refinar Resposta (Correção)</h3>
                    <textarea
                        className="w-full h-40 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6 text-gray-800 disabled:bg-gray-50 disabled:text-gray-500"
                        value={suggestion}
                        onChange={(e) => setSuggestion(e.target.value)}
                        placeholder="Escreva como o agente deveria ter respondido..."
                        disabled={!isPending}
                    />

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => navigate('/inbox')}
                            className="px-6 py-2 border rounded-lg hover:bg-gray-50 font-medium"
                        >
                            {isPending ? 'Cancelar' : 'Voltar'}
                        </button>
                        {isPending && (
                            <button
                                onClick={resolve}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm"
                            >
                                Resolver e Atualizar IA
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InboxDetail;
