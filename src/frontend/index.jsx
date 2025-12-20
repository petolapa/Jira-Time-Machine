import React, { useState, useEffect } from 'react';
import ForgeReconciler, {
  Heading,
  Text,
  Button,
  Box,
  Range,
  SectionMessage,
  Stack,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

/**
 * Project Page UI for "AI World Model: Future Simulator".
 *
 * This component demonstrates simple state management with React's useState hook
 * and Atlassian Forge UI Kit components. When the user presses the "Play Simulation"
 * button, we:
 *  1. Set the local state to "running" so the UI can show a loading bar/message.
 *  2. After a short timeout (simulating background computation), we set the state
 *     to "complete" and render the final result text.
 *
 * NOTE: We intentionally keep all state and behaviour on the frontend only.
 *       There is no backend call here because the UI is purely illustrative
 *       for the "Emergent Workflows" thesis.
 */
const App = () => {
  // Simple debug marker so we can verify that the UI has actually mounted.
  console.log('App started');

  // Jira context (e.g. current project) so that we can scope our risk analysis
  // to the project where the app is opened.
  //
  // NOTE: useProductContext() can be temporarily undefined while Forge initialises
  // the UI context, so we *do not* destructure directly from it. Instead we read
  // it into a variable and perform null checks before use.
  const productContext = useProductContext();
  // Debug logging to inspect what context we're actually receiving from Forge.
  console.log('DEBUG - productContext:', productContext);
  const platformContext = productContext && productContext.platformContext;

  // Slider-controlled inputs that represent key drivers of emergent workflow risk.
  const [teamCognitiveLoad, setTeamCognitiveLoad] = useState(50);
  const [systemComplexity, setSystemComplexity] = useState(50);
  const [absenceRisk, setAbsenceRisk] = useState(10);
  // Metrics derived from live Jira data for the current project.
  const [totalIssueCount, setTotalIssueCount] = useState(0);
  const [openIssueCount, setOpenIssueCount] = useState(0);
  // Count of issues that have passed their due date but are not yet completed.
  // This is a key indicator of emergent workflow delays and systemic bottlenecks.
  const [overdueCount, setOverdueCount] = useState(0);
  // Tracks whether we have been waiting "too long" for Jira to provide context.
  // This helps surface a clearer message if the app is not correctly installed.
  const [contextTimedOut, setContextTimedOut] = useState(false);
  // Tracks if we received a 403 permission error when trying to fetch Jira issues.
  // This indicates the app needs to be re-installed or permissions need to be granted.
  const [hasPermissionError, setHasPermissionError] = useState(false);
  // Simulation tasks fetched from backend resolver (for "What-if" scenarios)
  const [simulationTasks, setSimulationTasks] = useState([]);
  // Track if we've attempted to fetch simulation data
  const [hasFetchedSimulationData, setHasFetchedSimulationData] = useState(false);

  /**
   * Shared helper to (re)fetch simulation data for the current project.
   * This is used both on initial mount (via useEffect) and when the user
   * presses the "Refresh Data" button.
   */
  const refreshSimulationData = async () => {
    // DEBUG: Inspect the raw context we get from Forge.
    console.log('Frontend: Raw Context:', productContext);

    const extensionProjectKey =
      productContext?.extension?.project?.key ||
      productContext?.extension?.projectKey ||
      null;

    if (extensionProjectKey) {
      console.log(
        'Frontend: Detected Project Key from extension context:',
        extensionProjectKey
      );
    } else {
      console.log(
        'Frontend: Context not ready or project key missing in extension context.'
      );
    }

    const projectKey = extensionProjectKey || platformContext?.project?.key || null;

    if (!projectKey) {
      console.log(
        'Frontend: No projectKey available yet, skipping fetchSimulationData.'
      );
      return;
    }

    console.log('Frontend: Using Project Key for simulation fetch:', projectKey);

    try {
      console.log(
        '[Frontend] Calling invoke("fetchSimulationData") with projectKey:',
        projectKey
      );
      const result = await invoke('fetchSimulationData', { projectKey });

      console.log('[Frontend] Received result:', result);
      console.log('[Frontend] Result type:', typeof result);
      console.log('[Frontend] Result is array?', Array.isArray(result));
      console.log(
        '[Frontend] Result length:',
        Array.isArray(result) ? result.length : 'N/A'
      );

      const tasks = Array.isArray(result) ? result : [];
      setSimulationTasks(tasks);
      setHasFetchedSimulationData(true);
      setHasPermissionError(false);

      console.log('[Frontend] Set simulationTasks to:', tasks);
      console.log('[Frontend] Task count:', tasks.length);
    } catch (error) {
      console.error('[Frontend] Failed to fetch simulation data:', error);
      console.error('[Frontend] Error details:', {
        message: error.message,
        stack: error.stack,
        status: error?.status || error?.response?.status,
      });

      setSimulationTasks([]);
      setHasFetchedSimulationData(true);

      const statusCode = error?.status || error?.response?.status;
      if (statusCode === 403) {
        setHasPermissionError(true);
      }
    }
  };

  /**
   * Initial data fetch once we have a product context.
   */
  useEffect(() => {
    if (!productContext) {
      return;
    }

    refreshSimulationData();
  }, [productContext]);

  /**
   * Monitor the availability of the product context and trigger a timeout
   * if we have been waiting for more than 5 seconds.
   */
  useEffect(() => {
    // If we already have a project key, there is no need to start or keep a timeout.
    if (platformContext && platformContext.project?.key) {
      setContextTimedOut(false);
      return;
    }

    // Start a 5 second timer; if the context is still missing when it fires,
    // we mark the timeout so the UI can give a more actionable hint.
    const timeoutId = setTimeout(() => {
      setContextTimedOut(true);
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [platformContext]);

  /**
   * Helper function to interpret Team Cognitive Load value (0-100) into a user-friendly description.
   * Returns a string with emoji and descriptive text based on the load level.
   */
  const getLoadDescription = (value) => {
    if (value >= 0 && value <= 20) {
      return '🟢 Flow State (Single Focus)';
    } else if (value >= 21 && value <= 50) {
      return '🔵 Normal (Standard Overhead)';
    } else if (value >= 51 && value <= 75) {
      return '🟠 High (Frequent Context Switching)';
    } else {
      return '🔴 Overloaded (Thrashing/Firefighting)';
    }
  };

  /**
   * Helper function to interpret System Complexity value (0-100) into a user-friendly description.
   * Returns a string with emoji and descriptive text based on the complexity level.
   */
  const getComplexityDescription = (value) => {
    if (value >= 0 && value <= 20) {
      return '🟢 Monolith / Simple';
    } else if (value >= 21 && value <= 50) {
      return '🔵 Modular (Standard Integrations)';
    } else if (value >= 51 && value <= 75) {
      return '🟠 Distributed (Microservices)';
    } else {
      return '🔴 Spaghetti (Deep Dependency Chains)';
    }
  };

  /**
   * Given a probability percentage, return a short strategic recommendation
   * that helps the team respond to the emergent risk profile.
   */
  const getStrategicAdvice = (probability) => {
    if (probability == null) {
      return null;
    }

    if (probability >= 70) {
      return 'Critical emergent risk detected. Immediate scope reduction and cross-team swarming recommended.';
    }

    if (probability >= 50) {
      return 'High delay probability. Immediate scope reduction recommended and rebalancing of WIP limits.';
    }

    if (probability >= 30) {
      return 'Moderate risk. Consider simplifying system interactions and protecting focus time for the team.';
    }

    return 'Low projected delay risk. Maintain current workflow guardrails but monitor for local bottlenecks.';
  };

  /**
   * Calculate a "What-if" simulation for a single task based on the
   * current slider values for team cognitive load, system complexity, and absence risk.
   *
   * Math breakdown:
   * - Cognitive Load: treated as Velocity Drag. velocityModifier = 1 + (load / 100)
   * - System Complexity: treated as Integration Overhead. complexityDays = ceil((complexity / 100) * 5)
   * - Absence Risk (Stochastic): Random chance of worker sickness causing a 3-day block
   * - SimulatedDays = (RemainingDays * velocityModifier) + complexityDays + sicknessDays
   */
  const calculateSimulation = (task, load, complexity, absenceRisk) => {
    // Cognitive Load: treated as Velocity Drag
    const velocityModifier = 1 + (load / 100);
    
    // System Complexity: treated as Integration Overhead
    const complexityDays = Math.ceil((complexity / 100) * 5);
    
    // Absence Risk (Stochastic): Random chance of worker sickness
    const isWorkerSick = Math.random() * 100 < absenceRisk;
    const sicknessDays = isWorkerSick ? 3 : 0;

    // Use task due date if available, otherwise treat today as the baseline.
    const baseDate = task.duedate ? new Date(task.duedate) : new Date();
    baseDate.setHours(0, 0, 0, 0);
    
    // Calculate days between Today and Original Due Date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const remainingDays = Math.max(0, Math.ceil((baseDate - today) / (1000 * 60 * 60 * 24)));

    // Apply the formula: SimulatedDays = (RemainingDays * velocityModifier) + complexityDays + sicknessDays
    const simulatedDays = (remainingDays * velocityModifier) + complexityDays + sicknessDays;
    
    // Calculate the simulated date
    const simulatedDateObj = new Date(today);
    simulatedDateObj.setDate(simulatedDateObj.getDate() + Math.ceil(simulatedDays));
    
    // Calculate delay days (difference between simulated date and original due date)
    const delayDays = Math.max(0, Math.ceil((simulatedDateObj - baseDate) / (1000 * 60 * 60 * 24)));

    const formatDate = (date) => date.toISOString().slice(0, 10); // YYYY-MM-DD

    let riskLevel = 'Low';
    if (delayDays >= 15) {
      riskLevel = 'High';
    } else if (delayDays >= 5) {
      riskLevel = 'Medium';
    }

    return {
      simulatedDate: formatDate(simulatedDateObj),
      delayDays,
      isSick: isWorkerSick,
      riskLevel,
    };
  };

  // Dynamic probability of project risk based purely on current slider values.
  const probability = Math.min(
    99,
    Math.round(((teamCognitiveLoad + systemComplexity) / 200) * 100)
  );

  // If we don't yet have a valid product context (for example, while Forge is
  // still initialising the bridge between Jira and the app), render a light
  // placeholder instead of crashing.
  // Changed to check productContext directly to see if we're getting any context at all.
  if (!productContext) {
    return (
      <Box padding="space.400">
        {!contextTimedOut ? (
          <Text>Loading context...</Text>
        ) : (
          <Text>
            Still waiting for Jira context. Please ensure the app is installed on this site.
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Box padding="space.400">
      {/* Permission error message - show prominently if we got a 403 */}
      {hasPermissionError && (
        <Box paddingBlock="space.300">
          <SectionMessage appearance="error" title="Permission denied">
            <Text>
              Permission denied. Please try to refresh the page or re-install the app to trigger
              the access prompt.
            </Text>
          </SectionMessage>
        </Box>
      )}

      {/* Display fetched simulation tasks (temporary verification) */}
      {simulationTasks.length > 0 && (
        <Box paddingBlock="space.300">
          <Heading size="medium">Triton Simulation Data</Heading>
          <Stack space="space.200">
            {simulationTasks.map((task) => (
              <Box
                key={task.key}
                padding="space.200"
                backgroundColor="color.background.neutral.subtle"
                borderRadius="border.radius.200"
              >
                {(() => {
                  const sim = calculateSimulation(task, teamCognitiveLoad, systemComplexity, absenceRisk);
                  const originalDate = task.duedate ? new Date(task.duedate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
                  return (
                    <Stack space="space.050">
                      <Text>
                        {task.key} ({task.status?.name || 'Unknown status'}): {task.summary}
                      </Text>
                      <Text>
                        📅 Original: {originalDate} → 🔮 Simulated: {sim.simulatedDate}{' '}
                        {sim.delayDays > 0
                          ? `( +${sim.delayDays} days, ${sim.riskLevel} risk${sim.isSick ? ' 🤒 Sick Leave' : ''} )`
                          : `( On track${sim.isSick ? ' 🤒 Sick Leave' : ''} )`}
                      </Text>
                      <Text>
                        Assignee:{' '}
                        {task.assignee ? task.assignee.displayName : 'Unassigned'}
                      </Text>
                    </Stack>
                  );
                })()}
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Visual feedback if no data received from backend */}
      {hasFetchedSimulationData && !hasPermissionError && simulationTasks.length === 0 && (
        <Box paddingBlock="space.300">
          <SectionMessage appearance="warning" title="No data received from backend">
            <Text>
              No data received from backend. Check terminal logs for backend debug output.
              Expected keys: KAN-1, KAN-2, KAN-3
            </Text>
          </SectionMessage>
        </Box>
      )}

      {/* Emergent workflow input sliders */}
      <Box paddingBlock="space.300">
        <Stack space="space.300">
          <Box>
            <Heading size="small">Team Cognitive Load ({teamCognitiveLoad})</Heading>
            <Range
              min={0}
              max={100}
              step={1}
              value={teamCognitiveLoad}
              onChange={(value) => {
                // UI Kit Range passes the numeric value directly.
                setTeamCognitiveLoad(value);
              }}
            />
            <Text fontSize="small">
              {getLoadDescription(teamCognitiveLoad)}
            </Text>
            <Text fontSize="small">
              0 = Dedicated Focus. 100 = Constant interruptions. Adjust to match current team reality.
            </Text>
          </Box>

          <Box>
            <Heading size="small">System Complexity ({systemComplexity})</Heading>
            <Range
              min={0}
              max={100}
              step={1}
              value={systemComplexity}
              onChange={(value) => {
                setSystemComplexity(value);
              }}
            />
            <Text fontSize="small">
              {getComplexityDescription(systemComplexity)}
            </Text>
            <Text fontSize="small">
              Impact: Adds fixed integration wait times due to dependencies.
            </Text>
          </Box>

          <Box>
            <Heading size="small">Unexpected Absence Risk ({absenceRisk}%)</Heading>
            <Range
              min={0}
              max={100}
              step={1}
              value={absenceRisk}
              onChange={(value) => {
                setAbsenceRisk(value);
              }}
            />
            <Text fontSize="small">
              Impact: % Chance of a random event (e.g. sickness) causing a 3-day block.
            </Text>
          </Box>
        </Stack>
      </Box>

      {/* Main action area */}
      <Box paddingBlock="space.400">
        <Button
          appearance="primary" // Primary buttons are blue in Jira/Atlassian products.
          shouldFitContainer
          onClick={refreshSimulationData}
        >
          🔄 Refresh Data
        </Button>
      </Box>

      {/* Loading bar / progress feedback while the simulation is "running" */}
      {status === 'running' && (
        <Box paddingBlock="space.300">
          {/* This Box visually represents a simple loading bar. */}
          <Box
            padding="space.100"
            backgroundColor="color.background.neutral.subtle"
            borderRadius="border.radius.200"
          >
            <Box
              paddingBlock="space.050"
              backgroundColor="color.background.brand.bold"
              borderRadius="border.radius.200"
              // The width here is fixed for simplicity; in a real app you could
              // bind this to an actual numeric progress value in state.
              style={{ width: '70%' }}
            >
              <Text>Running simulation...</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Footer summary and strategic advice driven by live simulation data */}
      {simulationTasks.length > 0 && (
        <Box paddingBlock="space.400">
          <Stack space="space.200">
            {/* Display analyzed issue metrics based on the number of tasks fetched */}
            <Text>
              Analyzed {simulationTasks.length} active issues.
            </Text>

            <Text>
              Simulation complete. Estimated Project Risk: {probability}%.
            </Text>

            {/* Strategic guidance based on the emergent risk profile */}
            <SectionMessage
              title="Strategic workflow advice"
              appearance={
                probability >= 70
                  ? 'error'
                  : probability >= 50
                  ? 'warning'
                  : 'information'
              }
            >
              <Text>{getStrategicAdvice(probability)}</Text>
            </SectionMessage>
          </Stack>
        </Box>
      )}

      {/* Helper text reflecting real-time simulation behavior */}
      <Box paddingBlock="space.200">
        <Text>
          Adjust the sliders above to see real-time impact on projected delivery dates.
        </Text>
      </Box>
    </Box>
  );
};

ForgeReconciler.render(<App />);
