
(function () {
    // 1. Configurações Iniciais
    const CONFIG = {
        apiBase: 'http://localhost:8000', // URL do seu Backend
        agentId: 2, // ID do Agente padrão
        title: 'Suporte Inteligente',
        welcome: 'Olá! Como posso te ajudar hoje?',
        primaryColor: '#6366f1',
        headerColor: '#0f172a'
    };

    // Tentar pegar configurações da tag <script>
    const script = document.currentScript;
    if (script) {
        CONFIG.agentId = script.getAttribute('data-agent-id') || CONFIG.agentId;
        CONFIG.title = script.getAttribute('data-title') || CONFIG.title;
        CONFIG.primaryColor = script.getAttribute('data-primary-color') || CONFIG.primaryColor;
        CONFIG.headerColor = script.getAttribute('data-header-color') || CONFIG.headerColor;

        const dataWelcome = script.getAttribute('data-welcome');
        if (dataWelcome !== null) CONFIG.welcome = dataWelcome;
    }

    // 2. Criar Estrutura de Session
    let sessionId = localStorage.getItem('ag_chat_session');
    if (!sessionId) {
        sessionId = Math.random().toString(36).substring(7);
        localStorage.setItem('ag_chat_session', sessionId);
    }

    // 3. Injetar HTML e CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${CONFIG.apiBase}/static/widget.css`;
    document.head.appendChild(link);

    // Injetar variáveis de cores CSS
    const style = document.createElement('style');
    style.innerHTML = `
        :root {
            --ag-primary: ${CONFIG.primaryColor};
            --ag-header: ${CONFIG.headerColor};
        }
    `;
    document.head.appendChild(style);

    const widget = document.createElement('div');
    widget.id = 'antigravity-chat-widget';
    widget.innerHTML = `
        <div id="antigravity-chat-launcher">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        </div>
        <div id="antigravity-chat-window">
            <div class="ag-chat-header">
                <div class="status-dot"></div>
                <h3>${CONFIG.title}</h3>
            </div>
            <div class="ag-chat-messages" id="ag-messages-list">
                ${CONFIG.welcome ? `<div class="ag-message assistant">${CONFIG.welcome}</div>` : ''}
            </div>
            <div class="ag-chat-input">
                <input type="text" id="ag-user-input" placeholder="Digite sua dúvida...">
                <button id="ag-send-btn">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(widget);

    // 4. Lógica de Interação
    const launcher = document.getElementById('antigravity-chat-launcher');
    const windowChat = document.getElementById('antigravity-chat-window');
    const input = document.getElementById('ag-user-input');
    const sendBtn = document.getElementById('ag-send-btn');
    const messagesList = document.getElementById('ag-messages-list');

    launcher.addEventListener('click', () => {
        const isOpen = windowChat.classList.toggle('open');
        windowChat.style.display = isOpen ? 'flex' : 'none';
        if (isOpen) input.focus();
    });

    function addMessage(text, role) {
        const div = document.createElement('div');
        div.className = `ag-message ${role}`;
        div.innerText = text;
        messagesList.appendChild(div);
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        input.value = '';

        const typing = document.createElement('div');
        typing.className = 'ag-message assistant';
        typing.innerText = '...';
        messagesList.appendChild(typing);

        try {
            const res = await fetch(`${CONFIG.apiBase}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    agent_id: parseInt(CONFIG.agentId),
                    session_id: sessionId
                })
            });
            const data = await res.json();
            messagesList.removeChild(typing);
            addMessage(data.response, 'assistant');
        } catch (e) {
            messagesList.removeChild(typing);
            addMessage('Erro de conexão. Tente novamente.', 'assistant');
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

})();
