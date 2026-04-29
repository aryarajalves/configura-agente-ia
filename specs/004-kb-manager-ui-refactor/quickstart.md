# Quickstart: KB Manager UI Refactor

## How to test the changes

1. Open the **Knowledge Base Manager**.
2. Verify the `kb-quick-actions` bar contains exactly:
   - Adicionar Novo
   - Adicionar Documentos
   - Transcrição de Vídeo
   - Upload Json
3. Click **Adicionar Novo**:
   - Verify modal opens with the form.
   - Fill some data, close modal, reopen. Verify data persists.
   - Click "Adicionar à Base", verify item is added and modal closes.
4. Click **Adicionar Documentos**:
   - Click "Colar Texto". Verify the selection modal closes and the Paste modal opens.
   - Click "Upload PDF/DOCX". Verify the system file picker opens immediately.
   - Click "Importar CSV / Excel". Verify the importer flow starts.
