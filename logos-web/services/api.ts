import axios from 'axios';

const oldUrl = 'https://logos-web.onrender.com';
const newUrl = 'https://logos-debate.duckdns.org';
const apiUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:5001' : newUrl;

export const search = async (query: string, cursor = 0, additionalParams = {}) => {
  let url = `${apiUrl}/query?search=${query}&cursor=${cursor}`;
  Object.entries(additionalParams).forEach(([key, value]) => {
    url += `&${key}=${value}`;
  });

  const response = await axios.get(url);
  return { results: response.data.results, cursor: response.data.cursor };
};

export const getCard = async (id: string) => {
  const response = await axios.get(`${apiUrl}/card?id=${id}`);
  return response.data;
};

export const getSchools = async () => {
  const response = await axios.get(`${apiUrl}/schools`);
  return response.data;
};

export const uploadDocx = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${apiUrl}/upload-docx`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data as { ok: boolean; filename: string; cards_indexed: number };
};

export const clearIndex = async () => {
  const response = await axios.post(`${apiUrl}/clear-index`);
  return response.data as { ok: boolean };
};

export type ParsedDocument = {
  filename: string;
  cards_indexed: number;
  in_index: boolean;
  in_folder: boolean;
  folder_path?: string | null;
};

export const getParsedDocuments = async () => {
  const response = await axios.get(`${apiUrl}/documents`);
  return response.data as { documents: ParsedDocument[] };
};

export const deleteParsedDocument = async (filename: string, target: 'index' | 'folder') => {
  const response = await axios.post(`${apiUrl}/delete-document`, { filename, target });
  return response.data as {
    ok: boolean;
    removed_cards: number;
    removed_from_folder: boolean;
    deleted_path: string | null;
    message?: string;
  };
};

export const indexParsedDocument = async (filename: string) => {
  const response = await axios.post(`${apiUrl}/index-document`, { filename });
  return response.data as {
    ok: boolean;
    filename: string;
    cards_indexed: number;
  };
};

export const createUser = async (accessToken: string, refreshToken: string) => {
  await axios.post(`${apiUrl}/create-user`, { refresh_token: refreshToken }, { headers: { Authorization: `Bearer ${accessToken}` } });
};
