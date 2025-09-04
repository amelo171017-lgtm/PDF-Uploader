const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const customFileName = document.getElementById('customFileName');
const yearSelect = document.getElementById('yearSelect');
const typeSelect = document.getElementById('typeSelect');
const uploadBtn = document.getElementById('uploadBtn');
const loading = document.getElementById('loading');
const result = document.getElementById('result');
const fileLink = document.getElementById('fileLink');
const error = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');

let selectedFile = null;
let currentFileId = null;

document.addEventListener('DOMContentLoaded', function () {
    setupDragAndDrop();
    setupFileInput();
});

function setupDragAndDrop() {
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
}

function setupFileInput() {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
}

function handleFileSelect(file) {
    if (file.type !== 'application/pdf') {
        showError('Por favor, selecione apenas arquivos PDF.');
        return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
        showError('O arquivo é muito grande. Tamanho máximo permitido: 50MB');
        return;
    }

    selectedFile = file;
    displayFileInfo(file);

    const nameWithoutExtension = file.name.replace(/\.pdf$/i, '');
    customFileName.value = nameWithoutExtension;

    uploadBtn.disabled = false;
}

function displayFileInfo(file) {
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.style.display = 'block';
    uploadArea.style.display = 'none';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile() {
    selectedFile = null;
    fileInfo.style.display = 'none';
    uploadArea.style.display = 'block';
    uploadBtn.disabled = true;
    fileInput.value = '';
    customFileName.value = '';
    yearSelect.value = '';
    typeSelect.value = '';
}

async function uploadFile() {
    if (!selectedFile) {
        showError('Nenhum arquivo selecionado.');
        return;
    }

    const customName = customFileName.value.trim();
    if (!customName) {
        showError('Por favor, digite um nome para o arquivo.');
        return;
    }

    const year = yearSelect.value;
    if (!year) {
        showError('Por favor, selecione a série.');
        return;
    }

    const type = typeSelect.value;
    if (!type) {
        showError('Por favor, selecione o tipo.');
        return;
    }

    showLoading();

    try {
        const timestamp = Date.now();
        const sanitizedFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${timestamp}-${sanitizedFileName}`;


        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('pdfs')
            .upload(filePath, selectedFile, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            throw new Error(`Erro no upload: ${uploadError.message}`);
        }


        const { data: urlData } = supabase.storage
            .from('pdfs')
            .getPublicUrl(filePath);

        if (!urlData) {
            throw new Error('Erro ao gerar URL pública');
        }

        const publicUrl = urlData.publicUrl;

        const result = await saveToDatabase(filePath, selectedFile.name, selectedFile.size, publicUrl, customName, year, type);

        currentFileId = result.id;

        showResult(publicUrl);
    } catch (err) {
        showError(err.message || 'Erro ao fazer upload do arquivo.');
    }
}

async function saveToDatabase(filePath, originalName, fileSize, publicUrl, customName, year, type) {
    try {
        const { data, error } = await supabase
            .from('pdf_files')
            .insert({
                filename: filePath,
                original_name: originalName,
                name: customName,
                year: parseInt(year),
                type: type,
                file_size: fileSize,
                file_url: publicUrl
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Erro no banco: ${error.message}`);
        }

        return data;
    } catch (error) {
        throw new Error(error.message || 'Erro ao salvar no banco de dados');
    }
}

function showLoading() {
    hideAllSections();
    loading.style.display = 'flex';
}

function showResult(url) {
    hideAllSections();
    fileLink.value = url;
    result.style.display = 'block';
}

function showError(message) {
    hideAllSections();
    errorMessage.textContent = message;
    error.style.display = 'block';
}

function hideAllSections() {
    loading.style.display = 'none';
    result.style.display = 'none';
    error.style.display = 'none';
}

function copyLink() {
    fileLink.select();
    fileLink.setSelectionRange(0, 99999);

    try {
        document.execCommand('copy');
        showCopySuccess();
    } catch (err) {
        navigator.clipboard.writeText(fileLink.value).then(() => {
            showCopySuccess();
        }).catch(() => {
            showError('Erro ao copiar o link.');
        });
    }
}

function showCopySuccess() {
    const copyBtn = document.querySelector('.copy-btn');
    const originalText = copyBtn.innerHTML;

    copyBtn.innerHTML = '<i class="fas fa-check"></i>';
    copyBtn.style.background = '#28a745';

    setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.style.background = '#667eea';
    }, 2000);
}

function saveLink() {
    if (!fileLink.value) {
        showError('Nenhum link disponível.');
        return;
    }

    const saveBtn = document.querySelector('.save-btn');
    const originalText = saveBtn.innerHTML;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-check"></i> Link já salvo!';

    setTimeout(() => {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }, 2000);

}

function resetForm() {
    selectedFile = null;
    currentFileId = null;
    fileInput.value = '';
    customFileName.value = '';
    yearSelect.value = '';
    typeSelect.value = '';
    hideAllSections();
    fileInfo.style.display = 'none';
    uploadArea.style.display = 'block';
    uploadBtn.disabled = true;
}