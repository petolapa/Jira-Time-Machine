import React, { useState } from 'react';
import ForgeReconciler, {
  Heading,
  Text,
  Button,
  Box,
  Range,
  SectionMessage,
  Stack,
} from '@forge/react';

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
  // status can be: 'idle' | 'running' | 'complete'
  const [status, setStatus] = useState('idle');
  // Slider-controlled inputs that represent key drivers of emergent workflow risk.
  const [teamCognitiveLoad, setTeamCognitiveLoad] = useState(50);
  const [systemComplexity, setSystemComplexity] = useState(50);
  // Calculated probability of delay for the last completed simulation run.
  const [delayProbability, setDelayProbability] = useState(null);

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
   * We set the status to "running" and use a timeout to mimic a long‑running
   * AI / workflow simulation before showing the final result.
   */
  const handlePlaySimulation = () => {
    // If a simulation is already running, ignore extra clicks.
    if (status === 'running') {
      return;
    }

    // Compute a simple emergent-risk inspired probability model:
    //  - Cognitive load contributes 40%
    //  - System complexity contributes 40%
    //  - A stochastic 0–20% factor captures unpredictable emergent effects.
    const base =
      teamCognitiveLoad * 0.4 + systemComplexity * 0.4 + Math.random() * 20;
    const probability = Math.max(0, Math.min(100, Math.round(base)));

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
