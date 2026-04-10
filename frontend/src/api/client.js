import { API_URL, AGENT_API_KEY } from '../config';

const getHeaders = (options = {}) => {
    const headers = {
        ...(options.headers || {}),
        // 'X-API-Key': AGENT_API_KEY,
    };

    // Adiciona token se autenticado
    const token = localStorage.getItem('admin_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    return headers;
};

export const api = {
    async request(path, options = {}) {
        const url = path.startsWith('http') ? path : `${API_URL}${path}`;
        const finalOptions = {
            ...options,
            headers: getHeaders(options),
        };

        const response = await fetch(url, finalOptions);

        if (response.status === 401) {
            // Token expirado ou inválido
            localStorage.removeItem('admin_token');
            const isPublicRoute = window.location.pathname.startsWith('/chat/');
            if (!isPublicRoute && window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        return response;
    },

    get(path, options = {}) {
        return this.request(path, { ...options, method: 'GET' });
    },

    post(path, body, options = {}) {
        return this.request(path, { ...options, method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) });
    },

    put(path, body, options = {}) {
        return this.request(path, { ...options, method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body) });
    },

    delete(path, body, options = {}) {
        const fetchOptions = { ...options, method: 'DELETE' };
        if (body) {
            fetchOptions.body = body instanceof FormData ? body : JSON.stringify(body);
        }
        return this.request(path, fetchOptions);
    }
};
