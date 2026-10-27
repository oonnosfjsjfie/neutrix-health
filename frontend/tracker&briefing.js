// ==========================================
// 1. MODULE FOR: RECOVERY TRACKER LOGIC WITH TRIAGE
// ==========================================
const recoveryForm = document.getElementById('recoveryForm');
if (recoveryForm) {
    recoveryForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const temp = document.getElementById('temp').value;
        const bp = document.getElementById('bp').value || "Not provided";
        const sugar = document.getElementById('sugar').value;
        const weight = document.getElementById('weight').value;
        const symptoms = document.getElementById('trackerSymptoms').value.trim() || "None";
        const meds = document.querySelector('input[name="medsRadio"]:checked').value;

        // --- Integrated Warning Signs Triage Execution ---
        let triageMessage = '';
        if (symptoms !== "None") {
            const danger_signs = [
                "chest pain",
                "difficulty breathing",
                "severe bleeding",
                "fainting",
                "unconscious",
                "severe stomach pain",
                "blood in stool",
                "high fever"
            ];

            const normalText = symptoms.toLowerCase();
            let matchesDanger = danger_signs.some(phrase => normalText.includes(phrase));

            if (matchesDanger) {
                triageMessage = `<div class="alert-danger" style="background-color:#f8d7da; color:#842029; padding:15px; border-radius:4px; font-weight:bold; margin-bottom:15px;">This Symptom may need urgent medical attention. Please contact your doctor or go to the nearest hospital.</div>`;
            } else {
                triageMessage = `<div class="alert-warning" style="background:#fff3cd; color:#664d03; padding:15px; border-radius:4px; margin-bottom:15px;">Please monitor the symptom. If it becomes worse, contact your doctor.</div>`;
            }
        }

        const summaryBox = document.getElementById('trackerSummary');
        summaryBox.innerHTML = `
            <div class="alert-success" style="background:#d1e7dd; color:#0f5132; padding:10px; border-radius:4px; margin-bottom:15px;">Recovery details saved successfully.</div>
            ${triageMessage}
            <h3> Today’s Recovery Summary</h3>
            <p><strong>Temperature:</strong> ${temp} °F</p>
            <p><strong>Blood Pressure:</strong> ${bp}</p>
            <p><strong>Blood Sugar:</strong> ${sugar} mg/dL</p>
            <p><strong>Weight:</strong> ${weight} kg</p>
            <p><strong>Symptoms:</strong> ${symptoms}</p>
            <p><strong>Medicines Taken:</strong> ${meds}</p>
        `;
        
        summaryBox.classList.remove('hidden');
    });
}


// Scrolls to the top after saving (used by the Save button in tracking.html)
function topFunction() {
  document.body.scrollTop = 0; // For Safari
  document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
}
