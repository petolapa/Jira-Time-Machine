import React, { useState, useEffect } from 'react';
import ForgeReconciler, {
  Heading,
  Text,
  Button,
  Box,
  Range,
  SectionMessage,
  Stack,
} from '@forge/react';
import { useProductContext, requestJira } from '@forge/bridge';

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
  // Jira context (e.g. current project) so that we can scope our risk analysis
  // to the project where the app is opened.
  const { platformContext } = useProductContext();

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

  /**
   * Fetch issues for the current project using the Forge bridge.
   * We only request status information to keep the payload light, and then
   * derive how many of those issues are in "To Do" or "In Progress" states.
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
        const jql = `project = ${projectKey}`;

        const response = await requestJira(
          `/rest/api/3/search?jql=${encodeURIComponent(
            jql
          )}&maxResults=1000&fields=status`
        );
        const data = await response.json();

        if (isCancelled) {
          return;
        }

        const issues = Array.isArray(data.issues) ? data.issues : [];
        const total = typeof data.total === 'number' ? data.total : issues.length;

        // Count open issues based on Jira statusCategory: "To Do" or "In Progress".
        const openCount = issues.filter((issue) => {
          const statusCategoryName =
            issue?.fields?.status?.statusCategory?.name || '';
          return statusCategoryName === 'To Do' || statusCategoryName === 'In Progress';
        }).length;

        setTotalIssueCount(total);
        setOpenIssueCount(openCount);
      } catch (error) {
        // We log errors to the Forge logs; the UI will gracefully fall back
        // to showing zero analyzed issues rather than failing hard.
        console.error('Failed to fetch Jira issues for risk analysis', error);
      }
    };

    fetchIssues();

    return () => {
      isCancelled = true;
    };
  }, [platformContext?.project?.key]);

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

  return (
    <Box padding="space.400">
      {/* Main title matching the thesis concept */}
      <Heading size="large">AI World Model: Future Simulator</Heading>

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
            <Text>
              Simulation complete. Probability of delay:{' '}
              {delayProbability != null ? `${delayProbability}%` : 'N/A'}.
            </Text>

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
