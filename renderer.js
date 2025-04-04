const { contextBridge, ipcRenderer } = require('electron')
const XLSX = require('xlsx')

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.querySelector('.upload-zone');
    const fileInput = document.getElementById('fileInput');
    const progressContainer = document.querySelector('.progress-bar').parentElement.parentElement;
    const analysisPanel = document.querySelector('.bg-white.rounded-lg.shadow-sm.p-8:last-child'); // 获取分析面板

    // 初始状态隐藏分析面板
    analysisPanel.style.display = 'none';

    // 点击上传区域触发文件选择
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    // 处理文件上传
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // 检查文件类型
        if (!file.name.match(/\.(xlsx|xls)$/)) {
            alert('请上传 Excel 文件！');
            return;
        }

        try {
            // 更新上传区域显示选中的文件名
            const uploadText = uploadZone.querySelector('h3');
            const uploadDesc = uploadZone.querySelector('p');
            uploadText.textContent = file.name;
            
            // 显示进度条
            progressContainer.classList.remove('hidden');
            
            // 读取文件
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // 获取第一个工作表
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    
                    // 将工作表转换为JSON对象数组
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    // 处理数据，转换为所需的格式
                    const processedData = jsonData.map((row, index) => {
                        return {
                            id: index + 1,
                            ...row  // 展开原始数据
                        };
                    });

                    // 更新文件描述，显示数据条数
                    uploadDesc.textContent = `共 ${processedData.length} 条数据`;

                    // 显示分析面板
                    analysisPanel.style.display = 'block';

                    // 打印处理后的数据
                    console.log('Excel数据:', processedData);
                } catch (error) {
                    console.error('解析Excel数据时出错:', error);
                    alert('解析文件时出错，请检查文件格式是否正确');
                    // 恢复上传区域的默认显示
                    resetUploadZone();
                    // 隐藏分析面板
                    analysisPanel.style.display = 'none';
                }
            };

            reader.onerror = (error) => {
                console.error('读取文件时出错:', error);
                alert('读取文件时出错');
                // 恢复上传区域的默认显示
                resetUploadZone();
                // 隐藏分析面板
                analysisPanel.style.display = 'none';
            };

            reader.readAsArrayBuffer(file);

        } catch (error) {
            console.error('处理Excel文件时出错:', error);
            alert('处理文件时出错，请检查文件格式是否正确');
            // 恢复上传区域的默认显示
            resetUploadZone();
            // 隐藏分析面板
            analysisPanel.style.display = 'none';
        }
    });

    // 处理拖放
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('border-primary');
    });

    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('border-primary');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('border-primary');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            // 触发 change 事件
            const event = new Event('change');
            fileInput.dispatchEvent(event);
        }
    });

    // 修改重置上传区域显示的函数
    function resetUploadZone() {
        const uploadText = uploadZone.querySelector('h3');
        const uploadDesc = uploadZone.querySelector('p');
        uploadText.textContent = '点击或拖拽上传 Excel 文件';
        uploadDesc.textContent = '支持 .xlsx, .xls 格式文件';
        // 隐藏分析面板
        analysisPanel.style.display = 'none';
    }
});