/**
 * Utilitário central de configuração.
 * Prioriza variáveis injetadas em tempo de execução via window.configs (produção dinâmica),
 * e cai de volta para import.meta.env (desenvolvimento/build estático).
 */

const getEnv = (key, defaultValue = "") => {
    // Tenta pegar do window.configs (inserido pelo entrypoint.sh em produção)
    if (window.configs && key in window.configs && window.configs[key]) {
        return window.configs[key];
    }

    // Cai de volta para o mecanismo padrão do Vite
    return import.meta.env[key] || defaultValue;
};

export const API_URL = getEnv("VITE_API_URL", "http://localhost:8002");
export const AGENT_API_KEY = getEnv("VITE_AGENT_API_KEY", "");

export default {
    API_URL,
    AGENT_API_KEY
};
