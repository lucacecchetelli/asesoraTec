document.addEventListener("DOMContentLoaded", () => {
    function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    document.getElementById(tabId).classList.add('active');
        event.target.classList.add('active');
    }

    function openModal() {
        document.getElementById("modal").style.display = "flex";
    }

    function closeModal() {
        document.getElementById("modal").style.display = "none";
    }
    let teacherAdvisories =
        JSON.parse(localStorage.getItem("teacherAdvisories")) || [];

    sortAdvisories();
    generateSchedule();
    renderTeacherTable();
    renderTeacherAgenda();

});