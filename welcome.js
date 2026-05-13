document.addEventListener('DOMContentLoaded', () => {
    loadSettings();

    document.getElementById('saveBtn').addEventListener('click', () => {
        saveSettings((response) => {
            if (response?.status === 'saved') {
                setStatusMessage('設定已儲存');
            }
        });
    });

    document.getElementById('skipBtn').addEventListener('click', () => {
        document.getElementById('checkTime').value = DEFAULT_CHECK_TIME;
        document.getElementById('enableEndfield').checked = true;
        document.getElementById('enableArknights').checked = true;

        saveSettings((response) => {
            if (response?.status === 'saved') {
                setStatusMessage('已使用預設設定');
            }
        });
    });
});
