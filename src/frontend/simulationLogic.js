/**
 * Core simulation logic extracted from the frontend to allow for unit testing.
 * 
 * Math breakdown:
 * - Cognitive Load: treated as Velocity Drag. velocityModifier = 1 + (load / 100)
 * - System Complexity: treated as Integration Overhead. complexityDays = ceil((complexity / 100) * 5)
 * - Absence Risk (Stochastic): Random chance of worker sickness causing a 3-day block
 * - SimulatedDays = (RemainingDays * velocityModifier) + complexityDays + sicknessDays
 */
export const calculateSimulation = (task, load, complexity, absenceRisk, randomSeed = Math.random()) => {
    // Cognitive Load: treated as Velocity Drag
    const velocityModifier = 1 + (load / 100);

    // System Complexity: treated as Integration Overhead
    const complexityDays = Math.ceil((complexity / 100) * 5);

    // Absence Risk (Stochastic): Random chance of worker sickness
    const isWorkerSick = (randomSeed * 100) < absenceRisk;
    const sicknessDays = isWorkerSick ? 3 : 0;

    // Determine baseline date: if task is overdue, use today; otherwise use the due date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const originalDueDate = task.duedate ? new Date(task.duedate) : null;
    if (originalDueDate) {
        originalDueDate.setHours(0, 0, 0, 0);
    }

    // Check if task is overdue (due date is in the past)
    const isOverdue = originalDueDate && originalDueDate < today;

    // Set baseline: use today if overdue, otherwise use original due date (or today if no due date)
    const baselineDate = isOverdue ? today : (originalDueDate || today);

    // Calculate remaining days from baseline to original due date (for velocity calculation)
    const remainingDays = originalDueDate
        ? Math.max(0, Math.ceil((originalDueDate - baselineDate) / (1000 * 60 * 60 * 24)))
        : 0;

    // Apply the formula: SimulatedDays = (RemainingDays * velocityModifier) + complexityDays + sicknessDays
    const simulatedDays = (remainingDays * velocityModifier) + complexityDays + sicknessDays;

    // Calculate the simulated date by adding simulated days to baseline
    const simulatedDateObj = new Date(baselineDate);
    simulatedDateObj.setDate(simulatedDateObj.getDate() + Math.ceil(simulatedDays));

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
        riskLevel,
        isOverdue,
        originalDate: originalDueDate ? formatDate(originalDueDate) : null,
    };
};
