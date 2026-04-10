const getEnv = (key, defaultValue = "") => {
    // Tenta pegar do window.configs (inserido pelo entrypoint.sh em produção)
    if (window.configs && key in window.configs && window.configs[key]) {
        return window.configs[key];
    }

    // Cai de volta para o mecanismo padrão do Vite
    return import.meta.env[key] || defaultValue;
};

// Removendo o /v1 daqui e garantindo que ele venha da variável de ambiente ou do window.configs de forma limpa
export const API_URL = getEnv("VITE_API_URL", "http://localhost:8000/v1");
export const AGENT_API_KEY = getEnv("VITE_AGENT_API_KEY", "a0c10372-af47-4a36-932a-9b1acdb59366");

export default {
    API_URL,
    AGENT_API_KEY
};
