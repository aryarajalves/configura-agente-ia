import React, { useState, useEffect } from 'react';
import { api } from '../../api';

interface Persona {
    id: string;
    name: string;
    description: string;
}

const StressTestConfig = () => {
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [selectedPersona, setSelectedPersona] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<any>(null);

    useEffect(() => {
        fetchPersonas();
    }, []);

    const fetchPersonas = async () => {
        try {
            const response = await api.get('/v1/stress-tests/personas');
            setPersonas(response.data.data);
        } catch (error) {
            console.error('Error fetching personas', error);
        }
    };

    const startTest = async () => {
        if (!selectedPersona) return alert('Selecione uma persona');
        setLoading(true);
        try {
            const response = await api.post('/v1/stress-tests/', {
                persona_id: selectedPersona
            });
            alert('Teste de estresse iniciado!');
            checkStatus(response.data.data.id);
        } catch (error) {
            console.error('Error starting test', error);
            setLoading(false);
        }
    };

    const checkStatus = async (id: string) => {
        try {
            const response = await api.get(`/v1/stress-tests/${id}`);
            setStatus(response.data.data);
            if (response.data.data.status === 'PROCESSING' || response.data.data.status === 'QUEUED') {
                setTimeout(() => checkStatus(id), 2000);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error('Status check error', error);
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Simulação de Estresse (AI vs AI)</h1>

            <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecione a Persona de Teste
                </label>
                <select
                    className="w-full p-2 border rounded mb-4"
                    value={selectedPersona}
                    onChange={(e) => setSelectedPersona(e.target.value)}
                >
                    <option value="">-- Escolha uma Persona --</option>
                    {personas.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>

                <button
                    onClick={startTest}
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {loading ? 'Simulando...' : 'Iniciar Simulação (5 Conversas)'}
                </button>

                {status && (
                    <div className="mt-8 border-t pt-6">
                        <h2 className="font-semibold mb-2">Status do Teste</h2>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                            <div
                                className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                                style={{ width: `${status.progress}%` }}
                            ></div>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            Progresso: {status.progress}% - Status: <span className="font-bold">{status.status}</span>
                        </p>
                        {status.error_message && (
                            <p className="mt-2 text-red-500 font-semibold">{status.error_message}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StressTestConfig;
