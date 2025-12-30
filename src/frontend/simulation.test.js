import { calculateSimulation } from './simulationLogic';

describe('calculateSimulation', () => {
    const mockTask = {
        key: 'KAN-1',
        duedate: '2025-12-31'
    };

    // Mocking Date to ensure consistent tests
    const realDate = Date;
    beforeAll(() => {
        global.Date = class extends realDate {
            constructor(date) {
                if (date) return new realDate(date);
                return new realDate('2025-12-30'); // Today for testing
            }
        };
    });

    afterAll(() => {
        global.Date = realDate;
    });

    test('calculates base simulation with zero load and complexity', () => {
        const result = calculateSimulation(mockTask, 0, 0, 0, 0.5);
        // 2025-12-30 to 2025-12-31 is 1 day.
        // simulatedDays = (1 * 1) + 0 + 0 = 1
        // result.simulatedDate will be 2025-12-31
        expect(result.simulatedDate).toBe('2025-12-31');
        expect(result.riskDays).toBe(0);
    });

    test('adds complexity days', () => {
        const result = calculateSimulation(mockTask, 0, 50, 0, 0.5);
        // complexityDays = ceil(50/100 * 5) = 3
        // simulatedDays = 1 + 3 = 4
        // 2025-12-30 + 4 days = 2026-01-03
        expect(result.simulatedDate).toBe('2026-01-03');
        expect(result.riskDays).toBe(3);
    });

    test('applies sickness delay', () => {
        const result = calculateSimulation(mockTask, 0, 0, 100, 0.5); // 100% risk
        // sicknessDays = 3
        // simulatedDays = 1 + 3 = 4
        expect(result.isSick).toBe(true);
        expect(result.riskDays).toBe(3);
    });

    test('handles overdue tasks', () => {
        const overdueTask = { duedate: '2025-12-20' };
        const result = calculateSimulation(overdueTask, 0, 0, 0, 0.5);
        // Overdue task uses Today (2025-12-30) as baseline.
        // remainingDays = 0, complexity = 0, sickness = 0
        // simulatedDate = 2025-12-30
        expect(result.isOverdue).toBe(true);
        expect(result.simulatedDate).toBe('2025-12-30');
    });
});
