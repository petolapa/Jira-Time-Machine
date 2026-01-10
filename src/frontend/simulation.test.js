const { calculateSimulation } = require('./simulationLogic');

describe('calculateSimulation', () => {
    const mockTask = {
        key: 'KAN-1',
        duedate: '2025-12-31'
    };

    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-12-30T00:00:00.000Z'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    test('calculates base simulation with zero load and complexity', () => {
        const result = calculateSimulation(mockTask, 0, 0, 0, 0.5);
        // 2025-12-30 to 2025-12-31 is 1 day.
        // simulatedDays = (1 * 1) + 0 + 0 = 1
        // result.simulatedDate will be 2025-12-31
        expect(result.simulatedDate).toBe('2025-12-31');
        expect(result.riskDays).toBe(0);
    });

    test('adds complexity days (skipping weekends)', () => {
        const result = calculateSimulation(mockTask, 0, 50, 0, 0.5);
        // baseline = 2025-12-30 (Tue)
        // remaining = 1, complexityDays = 3 -> total simulated = 4 business days
        // Tue -> Wed(1), Thu(2), Fri(3), Mon(4)
        // result.simulatedDate will be 2026-01-05
        expect(result.simulatedDate).toBe('2026-01-05');
        expect(result.riskDays).toBe(3);
    });

    test('applies sickness delay (skipping weekends)', () => {
        const result = calculateSimulation(mockTask, 0, 0, 100, 0.5); // 100% risk
        // Tue -> Wed(1), Thu(2), Fri(3), Mon(4)
        expect(result.simulatedDate).toBe('2026-01-05');
        expect(result.isSick).toBe(true);
    });

    test('handles tangible shocks for specific members', () => {
        const taskWithAssignee = { ...mockTask, assignee: { accountId: 'user-123' } };
        const tangibleShock = { memberIds: ['user-123'], action: 'sick3' };

        const result = calculateSimulation(taskWithAssignee, 0, 0, 0, 0.5, tangibleShock);
        // Tue -> Wed(1), Thu(2), Fri(3), Mon(4)
        expect(result.isShocked).toBe(true);
        expect(result.simulatedDate).toBe('2026-01-05');
        expect(result.riskDays).toBe(3);
    });

    test('handles overdue tasks', () => {
        const overdueTask = { duedate: '2025-12-20' };
        const result = calculateSimulation(overdueTask, 0, 0, 0, 0.5);
        expect(result.isOverdue).toBe(true);
        expect(result.simulatedDate).toBe('2025-12-30');
    });
});
