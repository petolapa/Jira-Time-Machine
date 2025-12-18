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
import { requestJira } from '@forge/bridge';

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

  // status can be: 'idle' | 'running' | 'complete'
  const [status, setStatus] = useState('idle');
  // Slider-controlled inputs that represent key drivers of emergent workflow risk.
  const [teamCognitiveLoad, setTeamCognitiveLoad] = useState(50);
  const [systemComplexity, setSystemComplexity] = useState(50);
  // Calculated probability of delay for the last completed simulation run.
  const [delayProbability, setDelayProbability] = useState(null);
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

  /**
   * Fetch issues for the current project using the Forge bridge.
   * We request status and duedate fields to analyze both open issues and overdue tasks,
   * which are key signals of emergent workflow delays.
   */
  useEffect(() => {
    const projectKey = platformContext?.project?.key;
    if (!projectKey) {
      return;
    }

    let isCancelled = false;

    const fetchIssues = async () => {
      try {
        // Basic JQL: all issues in the current project.
        // Use quotes around the project key to ensure proper JQL syntax.
        const jql = 'project = "' + projectKey + '"';

        // Request both status and duedate fields to detect overdue tasks.
        // Using API version 2 for better compatibility.
        const response = await requestJira(
          `/rest/api/2/search?jql=${encodeURIComponent(
            jql
          )}&maxResults=1000&fields=status,duedate`
        );
        const data = await response.json();

        if (isCancelled) {
          return;
        }

        const issues = Array.isArray(data.issues) ? data.issues : [];
        const total = typeof data.total === 'number' ? data.total : issues.length;

        // Current date for comparison (we use the start of today to avoid timezone issues).
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Count open issues based on Jira statusCategory: "To Do" or "In Progress".
        const openCount = issues.filter((issue) => {
          const statusCategoryName =
            issue?.fields?.status?.statusCategory?.name || '';
          return statusCategoryName === 'To Do' || statusCategoryName === 'In Progress';
        }).length;

        // Count overdue issues: those with a duedate in the past that are not "Done".
        let overdue = 0;
        issues.forEach((issue) => {
          const duedateStr = issue?.fields?.duedate;
          const statusCategoryName =
            issue?.fields?.status?.statusCategory?.name || '';

          // Only count as overdue if:
          // 1. The issue has a duedate set
          // 2. The duedate is in the past (before today)
          // 3. The issue is not in "Done" status
          if (duedateStr && statusCategoryName !== 'Done') {
            // Jira returns duedate as YYYY-MM-DD string.
            const duedate = new Date(duedateStr);
            duedate.setHours(0, 0, 0, 0);

            if (duedate < today) {
              overdue++;
            }
          }
        });

        setTotalIssueCount(total);
        setOpenIssueCount(openCount);
        setOverdueCount(overdue);
        // Clear any previous permission error if the fetch succeeded.
        setHasPermissionError(false);
      } catch (error) {
        // We log errors to the Forge logs; the UI will gracefully fall back
        // to showing zero analyzed issues rather than failing hard.
        console.error('Failed to fetch Jira issues for risk analysis', error);

        // Enhanced error logging to help diagnose API issues.
        // Try to extract response text if available, otherwise log the error object.
        try {
          const errorDetails = error.response
            ? await error.response.text()
            : error;
          console.error('API Error details:', errorDetails);
        } catch (logError) {
          // If we can't read the response text, just log the original error.
          console.error('API Error details:', error);
        }

        // Check if this is a 403 permission error. The error might be a Response object
        // with a status property, or it might be structured differently.
        const status = error?.status || error?.response?.status;
        if (status === 403) {
          setHasPermissionError(true);
        }
      }
    };

    fetchIssues();

    return () => {
      isCancelled = true;
    };
  }, [platformContext?.project?.key]);

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
   * Handle click on "Play Simulation".
   * We combine:
   *  - Live Jira signal: number of currently open issues (To Do / In Progress)
   *  - Emergent system factors from sliders (complexity + randomness)
   *  - Team Cognitive Load as a multiplicative amplifier on the baseline risk
   *
   * This gives you a simple, data-driven "future simulator" for delay risk.
   */
  const handlePlaySimulation = () => {
    // If a simulation is already running, ignore extra clicks.
    if (status === 'running') {
      return;
    }

    // --- 1. Baseline risk from live Jira data (open issues) ---
    // Each open issue (To Do / In Progress) adds 5 percentage points of baseline risk.
    let baselineRisk = openIssueCount * 5;

    // If there are many open issues, we add a 10% uplift to represent queueing
    // and coordination overhead growing non-linearly.
    if (openIssueCount > 5) {
      baselineRisk = baselineRisk * 1.1;
    }

    // --- 1b. Overdue tasks amplify baseline risk ---
    // Each overdue task increases baseline risk by 15% to reflect the compounding
    // effect of missed deadlines on emergent workflow delays.
    baselineRisk = baselineRisk * (1 + overdueCount * 0.15);

    // --- 2. Emergent system contribution from complexity + randomness ---
    const emergentComponent = systemComplexity * 0.4 + Math.random() * 20;

    // --- 3. Team cognitive load as a multiplicative amplifier ---
    // We scale the baseline risk into [0, 1] using the cognitive load slider.
    const cognitiveFactor = teamCognitiveLoad / 100;
    let probability = baselineRisk * cognitiveFactor + emergentComponent;

    // Clamp to a sensible [0, 100] range.
    probability = Math.max(0, Math.min(100, Math.round(probability)));

    // Store the calculated probability so we can show it after the "run".
    setDelayProbability(probability);
    setStatus('running');

    // Simulate some processing delay (e.g. remote AI call or analysis).
    setTimeout(() => {
      setStatus('complete');
    }, 2500);
  };

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
      {/* Main title matching the thesis concept */}
      <Heading size="large">AI World Model: Future Simulator</Heading>

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

      {/* Feedback if no issues were found but there was no error */}
      {!hasPermissionError &&
        totalIssueCount === 0 &&
        platformContext?.project?.key && (
          <Box paddingBlock="space.300">
            <SectionMessage appearance="warning" title="No issues found">
              <Text>
                Check if JQL is matching any issues in project {platformContext.project.key}.
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
            <Text>
              Represents the mental juggling cost for the team: context switching, WIP, and
              coordination overhead.
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
            <Text>
              Captures integration surfaces, dependency depth, and coupling patterns in your
              delivery system.
            </Text>
          </Box>
        </Stack>
      </Box>

      {/* Main action area */}
      <Box paddingBlock="space.400">
        <Button
          appearance="primary" // Primary buttons are blue in Jira/Atlassian products.
          shouldFitContainer
          onClick={handlePlaySimulation}
        >
          {/* Using the play symbol directly in the label for clarity */}
          ▶ Play Simulation
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

      {/* Final result once the "simulation" is complete */}
      {status === 'complete' && (
        <Box paddingBlock="space.400">
          <Stack space="space.200">
            {/* Display analyzed issue metrics including overdue count */}
            <Text>
              Analyzed {openIssueCount} active issues ({overdueCount} overdue)
            </Text>

            <Text>
              Simulation complete. Probability of delay:{' '}
              {delayProbability != null ? `${delayProbability}%` : 'N/A'}.
            </Text>

            {/* Warning for systemic delay spiral if >50% of open issues are overdue */}
            {openIssueCount > 0 &&
              overdueCount > 0 &&
              overdueCount / openIssueCount > 0.5 && (
                <SectionMessage
                  title="Systemic delay spiral detected"
                  appearance="error"
                >
                  <Text>
                    Systemic delay spiral detected due to overdue backlog items. More than 50% of
                    active issues are past their due date, indicating a workflow breakdown that
                    requires immediate intervention.
                  </Text>
                </SectionMessage>
              )}

            {/* Strategic guidance based on the emergent risk profile */}
            {delayProbability != null && (
              <SectionMessage
                title="Strategic workflow advice"
                appearance={delayProbability >= 70 ? 'error' : delayProbability >= 50 ? 'warning' : 'information'}
              >
                <Text>{getStrategicAdvice(delayProbability)}</Text>
              </SectionMessage>
            )}
          </Stack>
        </Box>
      )}

      {/* Optional helper text for the idle state */}
      {status === 'idle' && (
        <Box paddingBlock="space.200">
          <Text>
            Press &quot;Play Simulation&quot; to run an emergent workflow scenario analysis for this
            project.
          </Text>
        </Box>
      )}
    </Box>
  );
};

ForgeReconciler.render(<App />);
