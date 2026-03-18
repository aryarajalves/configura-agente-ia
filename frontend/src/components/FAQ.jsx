import React from 'react';

const FAQ = () => {
    return (
        <div className="config-panel">
            <h2 className="panel-title">Principais Dúvidas</h2>
            <div className="form-section">
                <span className="section-label">Central de Ajuda</span>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                    <h3 style={{ color: 'var(--text-primary)' }}>Como criar um agente eficiente?</h3>
                    <p>Defina um prompt de sistema claro e escolha o modelo adequado para a complexidade da tarefa.</p>

                    <hr />

                    <h3 style={{ color: 'var(--text-primary)' }}>O que é a Janela de Contexto?</h3>
                    <p>É a quantidade de mensagens anteriores que o agente "lembra" durante a conversa.</p>

                    <hr />

                    <h3 style={{ color: 'var(--text-primary)' }}>Posso usar minhas próprias ferramentas?</h3>
                    <p>Sim, você pode configurar Webhooks na seção de ferramentas para que o agente execute ações externas.</p>
                </div>
            </div>
        </div>
    );
};

export default FAQ;
