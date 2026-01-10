/**
 * Core simulation logic extracted from the frontend to allow for unit testing.
 * 
 * Math breakdown:
 * - Cognitive Load: treated as Velocity Drag. velocityModifier = 1 + (load / 100)
 * - System Complexity: treated as Integration Overhead. complexityDays = ceil((complexity / 100) * 5)
 * - Absence Risk (Stochastic): Random chance of worker sickness causing a 3-day block
 * - SimulatedDays = (RemainingDays * velocityModifier) + complexityDays + sicknessDays
 */
const calculateSimulation = (task, load, complexity, absenceRisk, randomSeed = Math.random(), tangibleShock = null) => {
    // Cognitive Load: treated as Velocity Drag
    const velocityModifier = 1 + (load / 100);

    // System Complexity: treated as Integration Overhead
    const complexityDays = Math.ceil((complexity / 100) * 5);

    // Absence Risk (Stochastic): Random chance of worker sickness
    const isWorkerSick = (randomSeed * 100) < absenceRisk;
    const sicknessDays = isWorkerSick ? 3 : 0;

    // Tangible shock (new feature)
    let shockDays = 0;
    let isShocked = false;
    if (tangibleShock && tangibleShock.memberIds && tangibleShock.memberIds.length > 0) {
        const isMemberAffected = task.assignee && tangibleShock.memberIds.includes(task.assignee.accountId);
        if (isMemberAffected) {
            if (tangibleShock.action === 'sick3') {
                shockDays = 3;
                isShocked = true;
            }
        }
    }

    // Forced UTC parsing to avoid timezone-related date shifts
    const parseDate = (d) => {
        if (!d) return null;
        const dateStr = d.includes('T') ? d : `${d}T00:00:00Z`;
        return new Date(dateStr);
    };

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const originalDueDate = parseDate(task.duedate);
    if (originalDueDate) {
        originalDueDate.setUTCHours(0, 0, 0, 0);
    }

    // Check if task is overdue (due date is in the past)
    const isOverdue = originalDueDate && originalDueDate < today;

    // We always calculate remaining work from "today" for the What-if simulation
    const remainingDays = originalDueDate
        ? Math.max(0, Math.round((originalDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

    // Apply the formula: SimulatedDays = (RemainingDays * velocityModifier) + complexityDays + sicknessDays + shockDays
    const simulatedDays = (remainingDays * velocityModifier) + complexityDays + sicknessDays + shockDays;

    // Help to add days while skipping weekends
    const addBusinessDays = (startDate, daysToAdd) => {
        let date = new Date(startDate);
        let addedDays = 0;
        while (addedDays < daysToAdd) {
            date.setDate(date.getDate() + 1);
            if (date.getDay() !== 0 && date.getDay() !== 6) { // Skip Sunday (0) and Saturday (6)
                addedDays++;
            }
        }
        return date;
    };

    // Calculate the simulated date by adding simulated days to "today" (skipping weekends)
    const simulatedDateObj = addBusinessDays(today, Math.ceil(simulatedDays));

    // Calculate risk days (total additional days beyond baseline)
    const riskDays = Math.ceil(simulatedDays - remainingDays);

    // Calculate delay days (difference between simulated date and original due date)
    const delayDays = originalDueDate
        ? Math.max(0, Math.ceil((simulatedDateObj - originalDueDate) / (1000 * 60 * 60 * 24)))
        : riskDays;

    const formatDate = (date) => date.toISOString().slice(0, 10); // YYYY-MM-DD

    let riskLevel = 'Low';
    if (riskDays >= 15) {
        riskLevel = 'High';
    } else if (riskDays >= 5) {
        riskLevel = 'Medium';
    }

    return {
        simulatedDate: formatDate(simulatedDateObj),
        delayDays,
        riskDays,
        isSick: isWorkerSick,
        isShocked,
        riskLevel,
        isOverdue,
        originalDate: originalDueDate ? formatDate(originalDueDate) : null,
    };
};

module.exports = { calculateSimulation };
