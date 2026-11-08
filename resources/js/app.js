document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.module-panel');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // убираем active у всех кнопок
            tabButtons.forEach(b => b.classList.remove('active'));
            // добавляем активной нажатой
            btn.classList.add('active');

            // скрываем все панели
            panels.forEach(p => p.style.display = 'none');

            // показываем нужную
            const targetId = btn.dataset.target;
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) {
                targetPanel.style.display = 'block';
            }
        });
    });
});
