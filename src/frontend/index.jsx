import React, { useState, useEffect } from 'react';
import ForgeReconciler, {
  Heading,
  Text,
  Strong,
  Button,
  Box,
  Range,
  SectionMessage,
  Stack,
  Tooltip,
  Icon,
  Inline,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { calculateSimulation } from './simulationLogic';

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
  // Current status of the simulation: 'idle', 'running', or 'complete'
  const [status, setStatus] = useState('idle');

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
      setStatus('running');
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

      // Update summary metrics based on fetched tasks
      setTotalIssueCount(tasks.length);
      setOpenIssueCount(tasks.length); // All fetched tasks are unresolved per JQL

      // Count overdue issues before simulation
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overdue = tasks.filter(t => t.duedate && new Date(t.duedate) < today).length;
      setOverdueCount(overdue);

      setHasFetchedSimulationData(true);
      setHasPermissionError(false);
      setStatus('complete');

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
      setStatus('complete');

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
   * Helper function to interpret Team Cognitive Load value (0-100) into a user-friendly label.
   * Returns a string with emoji and descriptive text based on the load level.
   * Used in slider headers for dynamic display.
   */
  const getLoadLabel = (value) => {
    if (value >= 0 && value <= 20) {
      return '🟢 Flow State (Single Focus)';
    } else if (value >= 21 && value <= 50) {
      return '🔵 Optimal (Sustainable Pace)';
    } else if (value >= 51 && value <= 80) {
      return '🟠 High Load (Context Switching)';
    } else {
      return '🔴 Cognitive Overload (Thrashing)';
    }
  };

  /**
   * Helper function to interpret System Complexity value (0-100) into a user-friendly label.
   * Returns a string with emoji and descriptive text based on the complexity level.
   * Used in slider headers for dynamic display.
   */
  const getComplexityLabel = (value) => {
    if (value >= 0 && value <= 30) {
      return '🟢 Monolith / Low Dependencies';
    } else if (value >= 31 && value <= 60) {
      return '🔵 Modular / Standard';
    } else if (value >= 61 && value <= 85) {
      return '🟠 Distributed / High Friction';
    } else {
      return '🔴 Spaghetti / Entangled';
    }
  };

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
   * Thresholds adjusted for new average-based formula (lower values expected).
   */
  const getStrategicAdvice = (probability) => {
    if (probability == null) {
      return null;
    }

    if (probability > 60) {
      return 'Critical emergent risk detected. Immediate scope reduction and cross-team swarming recommended.';
    }

    if (probability > 40) {
      return 'High delay probability. Immediate scope reduction recommended and rebalancing of WIP limits.';
    }

    if (probability > 20) {
      return 'Moderate risk. Consider simplifying system interactions and protecting focus time for the team.';
    }

    return 'Low projected delay risk. Maintain current workflow guardrails but monitor for local bottlenecks.';
  };

  const probability = Math.round((teamCognitiveLoad + systemComplexity + absenceRisk) / 3);

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
    <Box padding="space.200">
      {/* Permission error message - show prominently if we got a 403 */}
      {
        hasPermissionError && (
          <Box paddingBlock="space.100">
            <SectionMessage appearance="error" title="Permission denied">
              <Text>
                Permission denied. Please try to refresh the page or re-install the app to trigger
                the access prompt.
              </Text>
            </SectionMessage>
          </Box>
        )
      }

      {/* Display fetched simulation tasks (temporary verification) */}
      {
        simulationTasks.length > 0 && (
          <Box paddingBlock="space.100">
            <Heading size="medium">Triton Simulation Data</Heading>
            <Stack space="space.100">
              {simulationTasks.map((task) => (
                <Box
                  key={task.key}
                  padding="space.150"
                  backgroundColor="color.background.neutral.subtle"
                  borderRadius="border.radius.200"
                >
                  {(() => {
                    // Create a deterministic seed from the task key to prevent 
                    // the "flicker" effect where sickness state jumps while moving sliders.
                    const seed = (task.key.split('-')[1] || 0) % 100 / 100;
                    const sim = calculateSimulation(task, teamCognitiveLoad, systemComplexity, absenceRisk, seed);
                    const originalDate = sim.originalDate || (task.duedate ? new Date(task.duedate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
                    return (
                      <Inline space="space.150" alignBlock="center">
                        <Text weight="medium">{task.key}</Text>
                        <Text>{task.summary}</Text>
                        <Text>
                          {sim.isOverdue
                            ? `📅 ${originalDate} → 🔮 ${sim.simulatedDate} (⚠️ +${sim.riskDays}d${sim.isSick ? ' 🤒' : ''})`
                            : `📅 ${originalDate} → 🔮 ${sim.simulatedDate} (+${sim.riskDays}d${sim.isSick ? ' 🤒' : ''})`}
                        </Text>
                        <Text fontSize="small" color="color.text.subtle">
                          {task.assignee ? task.assignee.displayName : 'Unassigned'}
                        </Text>
                      </Inline>
                    );
                  })()}
                </Box>
              ))}
            </Stack>
          </Box>
        )
      }

      {/* Visual feedback if no data received from backend */}
      {
        hasFetchedSimulationData && !hasPermissionError && simulationTasks.length === 0 && (
          <Box paddingBlock="space.100">
            <SectionMessage appearance="warning" title="No data received from backend">
              <Text>
                No data received from backend. Check terminal logs for backend debug output.
                Expected keys: KAN-1, KAN-2, KAN-3
              </Text>
            </SectionMessage>
          </Box>
        )
      }

      {/* Emergent workflow input sliders */}
      <Box paddingBlock="space.150">
        <Stack space="space.200">
          <Inline space="space.200" alignBlock="start">
            <Box style={{ width: '48%' }}>
              <Inline space="space.100" alignBlock="center">
                <Heading size="small">Team Cognitive Load ({teamCognitiveLoad})</Heading>
                <Tooltip content="Models velocity loss due to context switching overhead." position="top" shouldWrapChildren>
                  <Box>
                    <Icon glyph="info" label="Information" />
                  </Box>
                </Tooltip>
                <Text weight="medium">{getLoadLabel(teamCognitiveLoad)}</Text>
              </Inline>
              <Box paddingBlockStart="space.150">
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
              </Box>
            </Box>

            <Box style={{ width: '48%' }}>
              <Inline space="space.100" alignBlock="center">
                <Heading size="small">System Complexity ({systemComplexity})</Heading>
                <Tooltip content="Adds fixed integration wait times due to dependency depth." position="top" shouldWrapChildren>
                  <Box>
                    <Icon glyph="info" label="Information" />
                  </Box>
                </Tooltip>
                <Text weight="medium">{getComplexityLabel(systemComplexity)}</Text>
              </Inline>
              <Box paddingBlockStart="space.150">
                <Range
                  min={0}
                  max={100}
                  step={1}
                  value={systemComplexity}
                  onChange={(value) => {
                    setSystemComplexity(value);
                  }}
                />
              </Box>
            </Box>
          </Inline>

          <Inline space="space.200" alignBlock="start">
            <Box style={{ width: '48%' }}>
              <Inline space="space.100" alignBlock="center">
                <Heading size="small">Unexpected Absence Risk ({absenceRisk}%)</Heading>
                <Tooltip content="Probability of a stochastic event (like sickness) causing a 3-day delay." position="top" shouldWrapChildren>
                  <Box>
                    <Icon glyph="info" label="Information" />
                  </Box>
                </Tooltip>
              </Inline>
              <Box paddingBlockStart="space.150">
                <Range
                  min={0}
                  max={100}
                  step={1}
                  value={absenceRisk}
                  onChange={(value) => {
                    setAbsenceRisk(value);
                  }}
                />
              </Box>
            </Box>
          </Inline>
        </Stack>
      </Box>

      {/* Main action area */}
      <Box paddingBlock="space.100">
        <Button
          appearance="primary" // Primary buttons are blue in Jira/Atlassian products.
          shouldFitContainer
          onClick={refreshSimulationData}
        >
          🔄 Refresh Data
        </Button>
      </Box>

      {/* Loading bar / progress feedback while the simulation is "running" */}
      {
        status === 'running' && (
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
        )
      }

      {/* Footer summary and strategic advice driven by live simulation data */}
      {
        simulationTasks.length > 0 && (
          <Box paddingBlock="space.150">
            <Stack space="space.100">
              {/* Display analyzed issue metrics based on the number of tasks fetched */}
              <Text>
                Analyzed {simulationTasks.length} active issues.
              </Text>

              <Text>
                Simulation complete. Estimated Schedule Volatility: {probability}% (Risk of Emergent Delays)
              </Text>

              {/* Strategic guidance based on the emergent risk profile */}
              <SectionMessage
                title="Strategic workflow advice"
                appearance={
                  probability > 60
                    ? 'error'
                    : probability > 40
                      ? 'warning'
                      : probability > 20
                        ? 'information'
                        : 'success'
                }
              >
                <Text>{getStrategicAdvice(probability)}</Text>
              </SectionMessage>
            </Stack>
          </Box>
        )
      }

      {/* Helper text reflecting real-time simulation behavior */}
      <Box paddingBlock="space.100">
        <Text>
          Adjust the sliders above to see real-time impact on projected delivery dates.
        </Text>
      </Box>

      {/* Transparency footer explaining simulation model logic */}
      <Box paddingBlock="space.150">
        <SectionMessage appearance="change" title="Simulation Model Logic">
          <Stack space="space.050">
            <Text>• Cognitive Load models velocity loss (Context Switching theory).</Text>
            <Text>• System Complexity adds integration latency (Coupling theory).</Text>
            <Text>• Absence Risk applies Monte Carlo probability for resource shocks.</Text>
          </Stack>
        </SectionMessage>
      </Box>
    </Box>
  );
};

ForgeReconciler.render(<App />);
