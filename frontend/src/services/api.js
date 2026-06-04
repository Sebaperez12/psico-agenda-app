const API_URL = import.meta.env.VITE_API_URL;

function getToken() {
  return localStorage.getItem("token") || "";
}

function authHeaders(extra = {}) {
  const token = getToken();

  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  let res;

  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: authHeaders(options.headers || {}),
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Verifica que el backend este iniciado.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.msg || `Error ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

const api = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, body) =>
    request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  patch: (path, body) =>
    request(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  delete: (path) =>
    request(path, {
      method: "DELETE",
    }),
};

export default api;
