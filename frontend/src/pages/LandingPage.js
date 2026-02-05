import React, { useContext, useRef, useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  Divider,
  Avatar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
} from "@mui/material";
import {
  AutoAwesome,
  Psychology,
  GraphicEq,
  Mic,
  CameraAlt,
  Textsms,
  Tune,
  Share,
  CloudSync,
  Insights,
  Headphones,
  Bolt,
  Devices,
  Favorite,
  Group,
  School,
  Work,
  FitnessCenter,
  SelfImprovement,
  Nightlight,
  LocalCafe,
  Security,
  VerifiedUser,
  AccessibilityNew,
  ExpandMore,
  QueryStats,
  Timeline,
  Public,
  EmojiEvents,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { DarkModeContext } from "../context/DarkModeContext";
import "../App.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useContext(DarkModeContext);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const elements = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!elements.length) return;

    const prefersReducedMotion = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : true;
    const supportsObserver = "IntersectionObserver" in window;

    if (prefersReducedMotion || !supportsObserver) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -10% 0px" },
    );

    elements.forEach((element) => {
      element.classList.add("reveal");
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const styles = getStyles(isDarkMode);
  const getRevealProps = (delay = 0) => ({
    className: delay ? `reveal reveal-delay-${delay}` : "reveal",
    "data-reveal": "true",
  });

  return (
    <Box sx={styles.pageContainer}>
      <Box sx={styles.heroSection}>
        <Box sx={styles.heroGlowOne} />
        <Box sx={styles.heroGlowTwo} />
        <Container maxWidth="lg" sx={styles.heroContainer}>
          <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="overline"
                sx={styles.heroEyebrow}
                {...getRevealProps(1)}
              >
                Emotion-aware soundtracks
              </Typography>
              <Typography
                variant="h3"
                sx={styles.heroTitle}
                {...getRevealProps(1)}
              >
                Welcome to Moodify
              </Typography>
              <Typography
                variant="h6"
                sx={styles.heroSubtitle}
                {...getRevealProps(2)}
              >
                The AI-powered emotion-based music recommendation app that
                matches your mood with the perfect soundtrack.
              </Typography>
              <Typography
                variant="body1"
                sx={styles.heroBody}
                {...getRevealProps(2)}
              >
                From calm mornings to high-energy workouts, Moodify interprets
                how you feel and shapes a soundtrack that adapts in real time.
                Build emotional routines, save mood journeys, and keep your
                sound perfectly aligned with your day.
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={styles.heroButtons}
                {...getRevealProps(3)}
              >
                <Button
                  variant="contained"
                  sx={styles.primaryButton}
                  onClick={() => navigate("/register")}
                >
                  Get Started
                </Button>
                <Button
                  variant="outlined"
                  sx={styles.secondaryButton}
                  onClick={() => navigate("/login")}
                >
                  Log In
                </Button>
              </Stack>
              <Stack
                direction="row"
                spacing={0}
                flexWrap="wrap"
                sx={styles.heroChips}
                {...getRevealProps(3)}
              >
                {heroChips.map((chip) => (
                  <Chip key={chip} label={chip} sx={styles.heroChip} />
                ))}
              </Stack>
              <Grid container spacing={2} sx={styles.heroHighlights}>
                {heroHighlights.map((item, index) => {
                  const HighlightIcon = item.icon;
                  return (
                    <Grid item xs={12} sm={4} key={item.label}>
                      <Box
                        sx={styles.heroHighlightCard}
                        {...getRevealProps((index % 3) + 1)}
                      >
                        <Box sx={styles.iconBadge}>
                          <HighlightIcon fontSize="small" />
                        </Box>
                        <Typography variant="subtitle2" sx={styles.statLabel}>
                          {item.label}
                        </Typography>
                        <Typography variant="body2" sx={styles.statCaption}>
                          {item.description}
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={styles.heroPanel} {...getRevealProps(2)}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={styles.heroPanelHeader}
                >
                  <Typography variant="subtitle1" sx={styles.panelTitle}>
                    Live Mood Snapshot
                  </Typography>
                  <Chip label="Adaptive" size="small" sx={styles.panelChip} />
                </Stack>
                <Stack spacing={2} sx={styles.heroMoodList}>
                  {moodSignals.map((signal) => (
                    <Box key={signal.label}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={styles.heroMoodRow}
                      >
                        <Typography variant="caption" sx={styles.statLabel}>
                          {signal.label}
                        </Typography>
                        <Typography variant="caption" sx={styles.statCaption}>
                          {signal.value}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={signal.value}
                        sx={styles.heroProgress}
                      />
                    </Box>
                  ))}
                </Stack>
                <Divider sx={styles.heroDivider} />
                <Stack spacing={1.5}>
                  {heroTracks.map((track) => (
                    <Box key={track.title} sx={styles.heroTrack}>
                      <Avatar sx={styles.heroAvatar}>{track.short}</Avatar>
                      <Box>
                        <Typography variant="subtitle2" sx={styles.panelTitle}>
                          {track.title}
                        </Typography>
                        <Typography variant="caption" sx={styles.statCaption}>
                          {track.mood} · {track.duration}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
                <Box sx={styles.heroPanelFooter}>
                  <Typography variant="caption" sx={styles.statCaption}>
                    Updated just now
                  </Typography>
                  <Chip label="MoodSync" size="small" sx={styles.panelChip} />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.section}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={4} {...getRevealProps(1)}>
              <Typography variant="h4" sx={styles.sectionTitleLeft}>
                Designed for focus, calm, and momentum
              </Typography>
              <Typography variant="body1" sx={styles.sectionSubtitleLeft}>
                Moodify is a universal design-first music companion. Every
                interaction is built to be clear, inclusive, and adaptable,
                whether you are on mobile, desktop, or listening hands-free.
              </Typography>
              <Button
                variant="outlined"
                sx={styles.secondaryButton}
                onClick={() => navigate("/register")}
              >
                Explore the platform
              </Button>
            </Grid>
            <Grid item xs={12} md={8}>
              <Grid container spacing={3}>
                {stats.map((stat, index) => (
                  <Grid
                    item
                    xs={12}
                    sm={6}
                    key={stat.label}
                    {...getRevealProps((index % 3) + 1)}
                  >
                    <Box sx={styles.statsCard}>
                      <Typography variant="h4" sx={styles.statsValue}>
                        {stat.value}
                      </Typography>
                      <Typography variant="subtitle2" sx={styles.statLabel}>
                        {stat.label}
                      </Typography>
                      <Typography variant="body2" sx={styles.statCaption}>
                        {stat.description}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.logoSection}>
        <Container maxWidth="lg">
          <Typography
            variant="overline"
            sx={styles.logoEyebrow}
            {...getRevealProps(1)}
          >
            Trusted by creative teams and wellness leaders
          </Typography>
          <Grid container spacing={2}>
            {partners.map((partner, index) => (
              <Grid
                item
                xs={6}
                sm={4}
                md={2}
                key={partner}
                {...getRevealProps((index % 3) + 1)}
              >
                <Box sx={styles.logoCard}>{partner}</Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.metricsSection}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            sx={styles.sectionTitle}
            {...getRevealProps(1)}
          >
            Moodify at a glance
          </Typography>
          <Typography
            variant="body1"
            sx={styles.sectionSubtitle}
            {...getRevealProps(2)}
          >
            Real-time personalization backed by robust infrastructure and an
            always-learning emotional graph.
          </Typography>
          <Grid container spacing={3}>
            {megaStats.map((stat, index) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                key={stat.label}
                {...getRevealProps((index % 3) + 1)}
              >
                <Card sx={styles.megaStatCard}>
                  <CardContent>
                    <Typography variant="h3" sx={styles.megaStatValue}>
                      <CountUpNumber
                        value={stat.value}
                        suffix={stat.suffix}
                        decimals={stat.decimals}
                      />
                    </Typography>
                    <Typography variant="subtitle1" sx={styles.panelTitle}>
                      {stat.label}
                    </Typography>
                    <Typography variant="body2" sx={styles.statCaption}>
                      {stat.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.sectionAlt}>
        <Container maxWidth="lg">
          <Grid container spacing={5} alignItems="center">
            <Grid item xs={12} md={6} {...getRevealProps(1)}>
              <Typography variant="h4" sx={styles.sectionTitleLeft}>
                The emotion intelligence layer
              </Typography>
              <Typography variant="body1" sx={styles.sectionSubtitleLeft}>
                Moodify blends contextual signals, mood check-ins, and listening
                intent to deliver a soundscape that evolves with you. The engine
                stays lightweight and private, while still delivering highly
                personalized results.
              </Typography>
              <Stack spacing={2}>
                {enginePoints.map((point, index) => (
                  <Box
                    key={point.title}
                    sx={styles.enginePoint}
                    {...getRevealProps((index % 3) + 1)}
                  >
                    <Box sx={styles.iconBadge}>
                      <point.icon fontSize="small" />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" sx={styles.panelTitle}>
                        {point.title}
                      </Typography>
                      <Typography variant="body2" sx={styles.statCaption}>
                        {point.description}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={6} {...getRevealProps(2)}>
              <Card sx={styles.moodCard}>
                <CardContent>
                  <Typography variant="subtitle1" sx={styles.panelTitle}>
                    Mood Spectrum
                  </Typography>
                  <Typography variant="body2" sx={styles.statCaption}>
                    See how Moodify interprets your emotional blend in real
                    time.
                  </Typography>
                  <Stack spacing={2} sx={{ marginTop: "24px" }}>
                    {moodSpectrum.map((mood) => (
                      <Box key={mood.label}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Typography variant="caption" sx={styles.statLabel}>
                            {mood.label}
                          </Typography>
                          <Typography variant="caption" sx={styles.statCaption}>
                            {mood.value}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={mood.value}
                          sx={styles.moodProgress}
                        />
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.section}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={5} {...getRevealProps(1)}>
              <Typography variant="h4" sx={styles.sectionTitleLeft}>
                Precision you can feel
              </Typography>
              <Typography variant="body1" sx={styles.sectionSubtitleLeft}>
                Every Moodify moment is tuned for responsiveness and clarity.
                Our signal pipeline balances speed, accuracy, and user control
                with transparent feedback you can trust.
              </Typography>
              <Stack spacing={1.5}>
                {signalHighlights.map((item, index) => (
                  <Box
                    key={item.title}
                    sx={styles.signalHighlight}
                    {...getRevealProps((index % 3) + 1)}
                  >
                    <Box sx={styles.iconBadge}>
                      <item.icon fontSize="small" />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" sx={styles.panelTitle}>
                        {item.title}
                      </Typography>
                      <Typography variant="body2" sx={styles.statCaption}>
                        {item.description}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={7} {...getRevealProps(2)}>
              <Card sx={styles.signalCard}>
                <CardContent>
                  <Typography variant="subtitle1" sx={styles.panelTitle}>
                    Signal performance
                  </Typography>
                  <Typography variant="body2" sx={styles.statCaption}>
                    Real-time health metrics across the Moodify pipeline.
                  </Typography>
                  <Stack spacing={2} sx={{ marginTop: "20px" }}>
                    {signalMetrics.map((metric) => (
                      <Box key={metric.label}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Typography variant="caption" sx={styles.statLabel}>
                            {metric.label}
                          </Typography>
                          <Typography variant="caption" sx={styles.statCaption}>
                            <CountUpNumber
                              value={metric.value}
                              suffix={metric.suffix}
                              decimals={metric.decimals}
                            />
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={metric.progress}
                          sx={styles.signalProgress}
                        />
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.sectionAlt}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            sx={styles.sectionTitle}
            {...getRevealProps(1)}
          >
            Features
          </Typography>
          <Typography
            variant="body1"
            sx={styles.sectionSubtitle}
            {...getRevealProps(2)}
          >
            Professional-grade tools that stay intuitive for every listener.
          </Typography>
          <Grid container spacing={3}>
            {features.map((feature, index) => {
              const FeatureIcon = feature.icon;
              return (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  key={feature.title}
                  {...getRevealProps((index % 3) + 1)}
                >
                  <Card sx={styles.featureCard}>
                    <CardContent>
                      <Box sx={styles.featureHeader}>
                        <Box sx={styles.iconBadge}>
                          <FeatureIcon fontSize="small" />
                        </Box>
                        <Typography variant="h6" sx={styles.featureTitle}>
                          {feature.title}
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        sx={styles.featureDescription}
                      >
                        {feature.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.section}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            sx={styles.sectionTitle}
            {...getRevealProps(1)}
          >
            Inside Moodify
          </Typography>
          <Typography
            variant="body1"
            sx={styles.sectionSubtitle}
            {...getRevealProps(2)}
          >
            A curated experience built on emotional clarity, adaptive listening,
            and thoughtful rituals.
          </Typography>
          <Grid container spacing={3}>
            {pillars.map((pillar, index) => (
              <Grid
                item
                xs={12}
                md={4}
                key={pillar.title}
                {...getRevealProps((index % 3) + 1)}
              >
                <Card sx={styles.pillarCard}>
                  <CardContent>
                    <Box sx={styles.iconBadge}>
                      <pillar.icon fontSize="small" />
                    </Box>
                    <Typography variant="subtitle1" sx={styles.panelTitle}>
                      {pillar.title}
                    </Typography>
                    <Typography variant="body2" sx={styles.statCaption}>
                      {pillar.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.sectionAlt}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            sx={styles.sectionTitle}
            {...getRevealProps(1)}
          >
            How Moodify Works
          </Typography>
          <Typography
            variant="body1"
            sx={styles.sectionSubtitle}
            {...getRevealProps(2)}
          >
            A guided flow that keeps your experience smooth, accessible, and
            deeply personalized.
          </Typography>
          <Grid container spacing={3}>
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <Grid
                  item
                  xs={12}
                  md={3}
                  key={step.title}
                  {...getRevealProps((index % 3) + 1)}
                >
                  <Card sx={styles.stepCard}>
                    <CardContent>
                      <Box sx={styles.stepIcon}>
                        <StepIcon fontSize="small" />
                      </Box>
                      <Typography variant="subtitle1" sx={styles.panelTitle}>
                        {step.title}
                      </Typography>
                      <Typography variant="body2" sx={styles.statCaption}>
                        {step.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.section}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            sx={styles.sectionTitle}
            {...getRevealProps(1)}
          >
            Listening outcomes
          </Typography>
          <Typography
            variant="body1"
            sx={styles.sectionSubtitle}
            {...getRevealProps(2)}
          >
            Mindful sessions and productive routines that listeners rely on.
          </Typography>
          <Grid container spacing={3}>
            {outcomes.map((outcome, index) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={3}
                key={outcome.label}
                {...getRevealProps((index % 3) + 1)}
              >
                <Card sx={styles.outcomeCard}>
                  <CardContent>
                    <Typography variant="h4" sx={styles.outcomeValue}>
                      <CountUpNumber
                        value={outcome.value}
                        suffix={outcome.suffix}
                        decimals={outcome.decimals}
                      />
                    </Typography>
                    <Typography variant="subtitle1" sx={styles.panelTitle}>
                      {outcome.label}
                    </Typography>
                    <Typography variant="body2" sx={styles.statCaption}>
                      {outcome.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.sectionAlt}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            sx={styles.sectionTitle}
            {...getRevealProps(1)}
          >
            Built for Every Moment
          </Typography>
          <Typography
            variant="body1"
            sx={styles.sectionSubtitle}
            {...getRevealProps(2)}
          >
            Moodify adapts to the settings you care about most, from work and
            study to wellness and creative flow.
          </Typography>
          <Grid container spacing={3}>
            {useCases.map((useCase, index) => {
              const CaseIcon = useCase.icon;
              return (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  key={useCase.title}
                  {...getRevealProps((index % 3) + 1)}
                >
                  <Card sx={styles.useCaseCard}>
                    <CardContent>
                      <Box sx={styles.iconBadge}>
                        <CaseIcon fontSize="small" />
                      </Box>
                      <Typography variant="subtitle1" sx={styles.panelTitle}>
                        {useCase.title}
                      </Typography>
                      <Typography variant="body2" sx={styles.statCaption}>
                        {useCase.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.section}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            sx={styles.sectionTitle}
            {...getRevealProps(1)}
          >
            Curated Mood Journeys
          </Typography>
          <Typography
            variant="body1"
            sx={styles.sectionSubtitle}
            {...getRevealProps(2)}
          >
            Save, revisit, and share playlists that evolve with your emotional
            rhythm.
          </Typography>
          <Grid container spacing={3}>
            {journeys.map((journey, index) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                key={journey.title}
                {...getRevealProps((index % 3) + 1)}
              >
                <Card sx={styles.journeyCard}>
                  <CardContent>
                    <Typography variant="overline" sx={styles.journeyLabel}>
                      {journey.duration}
                    </Typography>
                    <Typography variant="h6" sx={styles.featureTitle}>
                      {journey.title}
                    </Typography>
                    <Typography variant="body2" sx={styles.statCaption}>
                      {journey.description}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      sx={{ marginTop: "16px" }}
                    >
                      {journey.tags.map((tag) => (
                        <Chip key={tag} label={tag} sx={styles.journeyChip} />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.sectionAlt}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={5} {...getRevealProps(1)}>
              <Typography variant="h4" sx={styles.sectionTitleLeft}>
                Seamless across devices and services
              </Typography>
              <Typography variant="body1" sx={styles.sectionSubtitleLeft}>
                Moodify connects with the tools you already use so your
                playlists and routines stay consistent across sessions.
              </Typography>
              <Stack
                direction="row"
                spacing={0}
                flexWrap="wrap"
                sx={styles.integrationChips}
              >
                {integrationBadges.map((badge) => (
                  <Chip key={badge} label={badge} sx={styles.heroChip} />
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={7} {...getRevealProps(2)}>
              <Grid container spacing={2}>
                {integrations.map((integration, index) => (
                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={4}
                    key={integration.title}
                    {...getRevealProps((index % 3) + 1)}
                  >
                    <Card sx={styles.integrationCard}>
                      <CardContent>
                        <Typography variant="subtitle1" sx={styles.panelTitle}>
                          {integration.title}
                        </Typography>
                        <Typography variant="body2" sx={styles.statCaption}>
                          {integration.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.section}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6} {...getRevealProps(1)}>
              <Typography variant="h4" sx={styles.sectionTitleLeft}>
                Universal design, built in
              </Typography>
              <Typography variant="body1" sx={styles.sectionSubtitleLeft}>
                We designed Moodify to be welcoming for every listener with
                clarity, comfort, and accessibility at the core.
              </Typography>
              <Stack spacing={2}>
                {accessibility.map((item, index) => (
                  <Box
                    key={item.title}
                    sx={styles.enginePoint}
                    {...getRevealProps((index % 3) + 1)}
                  >
                    <Box sx={styles.iconBadge}>
                      <item.icon fontSize="small" />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" sx={styles.panelTitle}>
                        {item.title}
                      </Typography>
                      <Typography variant="body2" sx={styles.statCaption}>
                        {item.description}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={6} {...getRevealProps(2)}>
              <Card sx={styles.trustCard}>
                <CardContent>
                  <Typography variant="subtitle1" sx={styles.panelTitle}>
                    Privacy and trust
                  </Typography>
                  <Typography variant="body2" sx={styles.statCaption}>
                    Your emotions stay yours. Moodify uses privacy-first design
                    and secure processing to keep your data safe.
                  </Typography>
                  <Grid container spacing={2} sx={{ marginTop: "16px" }}>
                    {trustSignals.map((signal, index) => (
                      <Grid
                        item
                        xs={12}
                        sm={6}
                        key={signal.title}
                        {...getRevealProps((index % 3) + 1)}
                      >
                        <Box sx={styles.trustItem}>
                          <Box sx={styles.iconBadge}>
                            <signal.icon fontSize="small" />
                          </Box>
                          <Typography
                            variant="subtitle2"
                            sx={styles.panelTitle}
                          >
                            {signal.title}
                          </Typography>
                          <Typography variant="body2" sx={styles.statCaption}>
                            {signal.description}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.sectionAlt}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            sx={styles.sectionTitle}
            {...getRevealProps(1)}
          >
            What Our Users Say
          </Typography>
          <Typography
            variant="body1"
            sx={styles.sectionSubtitle}
            {...getRevealProps(2)}
          >
            From creators to wellness teams, Moodify brings emotional clarity to
            every playlist.
          </Typography>
          <Grid container spacing={3}>
            {testimonials.map((testimonial, index) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                key={testimonial.author}
                {...getRevealProps((index % 3) + 1)}
              >
                <Card sx={styles.testimonialCard}>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={styles.testimonialAvatar}>
                        {testimonial.initials}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" sx={styles.panelTitle}>
                          {testimonial.author}
                        </Typography>
                        <Typography variant="caption" sx={styles.statCaption}>
                          {testimonial.role}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography variant="body2" sx={styles.testimonialText}>
                      “{testimonial.text}”
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box sx={styles.sectionAlt}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            sx={styles.sectionTitle}
            {...getRevealProps(1)}
          >
            Frequently Asked Questions
          </Typography>
          <Typography
            variant="body1"
            sx={styles.sectionSubtitle}
            {...getRevealProps(2)}
          >
            Everything you need to know about getting started with Moodify.
          </Typography>
          <Stack spacing={2}>
            {faqs.map((faq, index) => (
              <Box key={faq.question} {...getRevealProps((index % 3) + 1)}>
                <Accordion sx={styles.faqCard}>
                  <AccordionSummary
                    expandIcon={<ExpandMore />}
                    sx={styles.faqSummary}
                  >
                    <Typography variant="subtitle1" sx={styles.panelTitle}>
                      {faq.question}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={styles.faqDetails}>
                    <Typography variant="body2" sx={styles.faqAnswer}>
                      {faq.answer}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      <Box sx={styles.ctaSection}>
        <Container maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>
          <Typography variant="h4" sx={styles.ctaTitle} {...getRevealProps(1)}>
            Start building your emotional soundtrack today
          </Typography>
          <Typography
            variant="body1"
            sx={styles.ctaSubtitle}
            {...getRevealProps(2)}
          >
            Join Moodify and create playlists that evolve with every feeling.
            Bring focus to work, calm to your routines, and energy when you need
            it most.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="center"
            {...getRevealProps(3)}
          >
            <Button
              variant="contained"
              sx={styles.primaryButton}
              onClick={() => navigate("/register")}
            >
              Create your account
            </Button>
            <Button
              variant="outlined"
              sx={styles.secondaryButton}
              onClick={() => navigate("/login")}
            >
              Talk to us
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

const CountUpNumber = ({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  duration = 1600,
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || hasAnimated) return;

    if (typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : true;
    const supportsObserver = "IntersectionObserver" in window;

    if (prefersReducedMotion || !supportsObserver) {
      setDisplayValue(value);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setHasAnimated(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value, hasAnimated]);

  useEffect(() => {
    if (!hasAnimated) return;

    let start = null;
    let frame = null;

    const tick = (timestamp) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [hasAnimated, value, duration]);

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(displayValue);

  return (
    <span ref={ref}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

const heroChips = [
  "Privacy-first personalization",
  "Universal design focus",
  "Multi-input emotion AI",
];

const heroHighlights = [
  {
    label: "3 Input Modes",
    description: "Text, voice, or camera",
    icon: Mic,
  },
  {
    label: "Adaptive Engine",
    description: "Updates in real time & on the fly",
    icon: Bolt,
  },
  {
    label: "Cross-Platform",
    description: "Web, mobile, desktop",
    icon: Devices,
  },
];

const moodSignals = [
  { label: "Calm", value: 72 },
  { label: "Focus", value: 64 },
  { label: "Energy", value: 58 },
  { label: "Confidence", value: 81 },
];

const heroTracks = [
  {
    title: "Soft Sunrise",
    mood: "Gentle · Warm",
    duration: "3:24",
    short: "SS",
  },
  {
    title: "Clear Focus",
    mood: "Intentional · Crisp",
    duration: "2:58",
    short: "CF",
  },
  {
    title: "Glow State",
    mood: "Uplifting · Bright",
    duration: "4:02",
    short: "GS",
  },
];

const stats = [
  {
    value: "100+",
    label: "Mood tags",
    description: "Capture nuance beyond basic emotions.",
  },
  {
    value: "3",
    label: "Input modes",
    description: "Type, speak, or use facial cues.",
  },
  {
    value: "Real-time",
    label: "Adaptive playlists",
    description: "Soundtracks shift with your energy.",
  },
  {
    value: "Anywhere",
    label: "Device continuity",
    description: "Pick up where you left off.",
  },
];

const megaStats = [
  {
    value: 48,
    suffix: "M+",
    decimals: 0,
    label: "Emotion signals processed",
    description: "Continuous personalization across active listeners.",
  },
  {
    value: 1.2,
    suffix: "B+",
    decimals: 1,
    label: "Track embeddings analyzed",
    description: "Deep learning context to match every feeling.",
  },
  {
    value: 99.98,
    suffix: "%",
    decimals: 2,
    label: "MoodSync uptime",
    description: "Reliable access to your playlists all day.",
  },
  {
    value: 120,
    suffix: "k",
    decimals: 0,
    label: "Daily listening sessions",
    description: "Mood-led soundtracks started every day.",
  },
  {
    value: 65,
    suffix: "+",
    decimals: 0,
    label: "Supported languages",
    description: "Global-ready insights and onboarding.",
  },
  {
    value: 14,
    suffix: "k+",
    decimals: 0,
    label: "Community mood journeys",
    description: "Shared playlists curated by listeners.",
  },
];

const partners = [
  "Aurora Health",
  "Northwind Labs",
  "Beacon Studio",
  "PulseWorks",
  "Lumen Collective",
  "Horizon Campus",
];

const enginePoints = [
  {
    title: "Emotion detection you can trust",
    description:
      "Blend self-reported mood with contextual signals for accuracy.",
    icon: Psychology,
  },
  {
    title: "Real-time music intelligence",
    description: "Adaptive recommendations keep pace with your day.",
    icon: GraphicEq,
  },
  {
    title: "Personal insights",
    description: "Understand how music influences your focus and energy.",
    icon: Insights,
  },
];

const moodSpectrum = [
  { label: "Relaxed", value: 76 },
  { label: "Focused", value: 68 },
  { label: "Motivated", value: 61 },
  { label: "Joyful", value: 83 },
];

const signalHighlights = [
  {
    title: "Instant feedback loops",
    description: "Live updates show how your mood mix is changing.",
    icon: Timeline,
  },
  {
    title: "Mood confidence scores",
    description: "Clear guidance on what the engine is sensing.",
    icon: QueryStats,
  },
  {
    title: "Global listening graph",
    description: "Tune into shared mood patterns across regions.",
    icon: Public,
  },
];

const signalMetrics = [
  {
    label: "Emotion accuracy",
    value: 93.4,
    suffix: "%",
    decimals: 1,
    progress: 93,
  },
  {
    label: "Response latency",
    value: 120,
    suffix: "ms",
    decimals: 0,
    progress: 82,
  },
  {
    label: "Adaptive refresh rate",
    value: 6,
    suffix: "x/hr",
    decimals: 0,
    progress: 70,
  },
  {
    label: "Daily mood journaling",
    value: 14,
    suffix: " days",
    decimals: 0,
    progress: 64,
  },
];

const features = [
  {
    title: "Emotion-Based Recommendations",
    description:
      "Receive playlists tailored to your emotional state in real time.",
    icon: AutoAwesome,
  },
  {
    title: "Multi-Input Mood Capture",
    description: "Share your feelings via text, voice, or camera input.",
    icon: Textsms,
  },
  {
    title: "Adaptive Listening Engine",
    description: "Moodify adjusts your soundtrack as your energy shifts.",
    icon: Tune,
  },
  {
    title: "Personal Mood Insights",
    description: "Track mood patterns and understand music impact.",
    icon: Insights,
  },
  {
    title: "Focus & Flow Modes",
    description: "Curated sessions for deep work, study, or creativity.",
    icon: Headphones,
  },
  {
    title: "Social Sharing",
    description: "Share mood journeys and playlists with your circle.",
    icon: Share,
  },
  {
    title: "Cloud Sync",
    description: "Stay consistent across devices with secure sync.",
    icon: CloudSync,
  },
  {
    title: "Feel-Good Favorites",
    description: "Save playlists that always lift your mood.",
    icon: Favorite,
  },
];

const pillars = [
  {
    title: "Emotion Graph",
    description:
      "Map your mood patterns with a personalized emotional fingerprint.",
    icon: QueryStats,
  },
  {
    title: "Adaptive Curation",
    description:
      "Playlists evolve as your energy shifts, without disrupting flow.",
    icon: AutoAwesome,
  },
  {
    title: "Listening Rituals",
    description: "Build recurring routines for focus, calm, or confidence.",
    icon: EmojiEvents,
  },
];

const steps = [
  {
    title: "Check in",
    description: "Tell Moodify how you feel using any input method.",
    icon: CameraAlt,
  },
  {
    title: "Analyze",
    description: "Our engine interprets your emotional context instantly.",
    icon: AutoAwesome,
  },
  {
    title: "Listen",
    description: "Enjoy a soundtrack designed to match and elevate your mood.",
    icon: Headphones,
  },
  {
    title: "Reflect",
    description: "Review mood journeys and adjust preferences anytime.",
    icon: Insights,
  },
];

const outcomes = [
  {
    label: "Focus lift",
    value: 42,
    suffix: "%",
    decimals: 0,
    description: "Listeners report deeper flow sessions.",
  },
  {
    label: "Stress reduction",
    value: 28,
    suffix: "%",
    decimals: 0,
    description: "Mood-calming playlists used daily.",
  },
  {
    label: "Session retention",
    value: 3.4,
    suffix: "x",
    decimals: 1,
    description: "Average session extension with mood sync.",
  },
  {
    label: "Weekly rituals",
    value: 5,
    suffix: "+",
    decimals: 0,
    description: "Personal routines saved per listener.",
  },
];

const useCases = [
  {
    title: "Focused Work",
    description: "Stay in the zone with distraction-free soundscapes.",
    icon: Work,
  },
  {
    title: "Study Sessions",
    description: "Maintain clarity and retention with calming tracks.",
    icon: School,
  },
  {
    title: "Fitness Boost",
    description: "Find the tempo that pushes you through your workout.",
    icon: FitnessCenter,
  },
  {
    title: "Mindful Breaks",
    description: "Reset your nervous system with gentle audio rituals.",
    icon: SelfImprovement,
  },
  {
    title: "Evening Wind-Down",
    description: "Transition into rest with soft nighttime playlists.",
    icon: Nightlight,
  },
  {
    title: "Creative Flow",
    description: "Spark ideas with cinematic and ambient moods.",
    icon: LocalCafe,
  },
];

const journeys = [
  {
    title: "Calm Morning Reset",
    description:
      "Breathe into your day with gentle acoustic and ambient tones.",
    duration: "30 min",
    tags: ["Calm", "Soft Focus"],
  },
  {
    title: "Deep Work Sprint",
    description: "Instrumental rhythms built for sustained concentration.",
    duration: "45 min",
    tags: ["Focus", "Flow"],
  },
  {
    title: "Mood Lift",
    description: "Bright, uplifting tracks that elevate energy and optimism.",
    duration: "25 min",
    tags: ["Uplift", "Energy"],
  },
  {
    title: "Creative Studio",
    description: "Layered textures and cinematic soundscapes for ideation.",
    duration: "40 min",
    tags: ["Creativity", "Inspire"],
  },
  {
    title: "Evening Unwind",
    description: "Slow it down with warm vocals and mellow instrumentals.",
    duration: "35 min",
    tags: ["Relax", "Night"],
  },
  {
    title: "Energy Boost",
    description: "High-tempo momentum when you need a quick recharge.",
    duration: "20 min",
    tags: ["Motivation", "Pulse"],
  },
];

const integrations = [
  {
    title: "Streaming Sync",
    description: "Keep favorites aligned across devices and sessions.",
  },
  {
    title: "Calendar Focus",
    description: "Auto-launch focus playlists with your schedule.",
  },
  {
    title: "Wearables",
    description: "Adapt playlists based on heart rate and activity.",
  },
  {
    title: "Smart Speakers",
    description: "Voice-controlled mood changes at home.",
  },
  {
    title: "Collaboration",
    description: "Share moods and playlists with your team.",
  },
  {
    title: "Wellness Apps",
    description: "Blend music into mindful routines and journaling.",
  },
  {
    title: "Focus Tools",
    description: "Pair Moodify with timers and productivity stacks.",
  },
  {
    title: "Health Platforms",
    description: "Integrate mood data with wellness insights.",
  },
  {
    title: "Social Sharing",
    description: "Easily share your mood journeys with friends.",
  },
];

const integrationBadges = [
  "Smart speakers",
  "Wearables",
  "Wellness platforms",
  "Calendar sync",
  "Team spaces",
];

const accessibility = [
  {
    title: "High-contrast modes",
    description: "Legible color systems for light and dark environments.",
    icon: AccessibilityNew,
  },
  {
    title: "Voice-first navigation",
    description: "Hands-free listening for focus and mobility needs.",
    icon: Mic,
  },
  {
    title: "Reduced motion support",
    description: "Gentle animations to support comfort and focus.",
    icon: Tune,
  },
  {
    title: "Clear layout hierarchy",
    description: "Predictable spacing, typography, and structure.",
    icon: Group,
  },
];

const trustSignals = [
  {
    title: "Secure processing",
    description: "Protected pipelines for sensitive emotional data.",
    icon: Security,
  },
  {
    title: "Privacy-first",
    description: "You choose what is shared and saved.",
    icon: VerifiedUser,
  },
  {
    title: "Ethical AI",
    description: "Transparent recommendations you can control.",
    icon: Psychology,
  },
  {
    title: "Support ready",
    description: "Guidance for teams and power listeners.",
    icon: Headphones,
  },
];

const testimonials = [
  {
    author: "Ricky Nguyen",
    initials: "RN",
    role: "Creator",
    text: "Moodify helps me dial in the exact vibe I need before recording.",
  },
  {
    author: "Katarina Chen",
    initials: "KC",
    role: "Wellness Coach",
    text: "The mood journeys are perfect for guiding clients into calm.",
  },
  {
    author: "Adam Smith",
    initials: "AS",
    role: "Product Designer",
    text: "I love the adaptive playlists for deep work sessions.",
  },
  {
    author: "Richard Le",
    initials: "RL",
    role: "Student",
    text: "Moodify makes studying feel effortless and focused.",
  },
  {
    author: "Amina Noor",
    initials: "AN",
    role: "Team Lead",
    text: "We use Moodify during team focus blocks and it just works.",
  },
  {
    author: "Luis Ortega",
    initials: "LO",
    role: "Fitness Coach",
    text: "The energy playlists help my clients stay motivated.",
  },
];

// eslint-disable-next-line no-unused-vars
const pricing = [
  {
    title: "Starter",
    price: "Free",
    description: "Personal mood playlists and daily check-ins.",
    features: [
      "Mood-based playlists",
      "Text input and journaling",
      "Saved mood journeys",
    ],
    cta: "Start free",
  },
  {
    title: "Pro",
    price: "$12 / month",
    description: "Advanced personalization and insights.",
    features: [
      "Voice and camera input",
      "Mood analytics dashboard",
      "Cross-device continuity",
      "Custom focus routines",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    title: "Teams",
    price: "$24 / user",
    description: "Shared moods, admin controls, and collaboration.",
    features: [
      "Team playlists",
      "Shared focus blocks",
      "Priority onboarding",
      "Admin visibility",
    ],
    cta: "Contact sales",
  },
];

const faqs = [
  {
    question: "How does Moodify understand my mood?",
    answer:
      "Moodify blends your input with contextual signals to interpret your current emotional state and recommend playlists that match your intent.",
  },
  {
    question: "Can I use Moodify without camera or voice input?",
    answer:
      "Yes. Text-based mood check-ins are always available and work seamlessly with the recommendation engine.",
  },
  {
    question: "Is Moodify available on mobile and desktop?",
    answer:
      "Moodify syncs across devices, so you can start a session on web and continue on mobile or desktop without losing context.",
  },
  {
    question: "Do I control what gets saved?",
    answer:
      "Absolutely. You decide which mood journeys or insights are stored, and you can remove them at any time.",
  },
  {
    question: "Can teams use Moodify together?",
    answer:
      "Teams can share focus sessions, mood journeys, and curated playlists while keeping individual preferences private.",
  },
  {
    question: "What makes Moodify different?",
    answer:
      "Moodify is built for emotional clarity with universal design principles, making it easy, inclusive, and personalized for every listener.",
  },
];

const getStyles = (isDarkMode) => {
  const palette = {
    bg: isDarkMode ? "#0f1115" : "#f7f4f1",
    surface: isDarkMode ? "#191d26" : "#ffffff",
    surfaceAlt: isDarkMode ? "#151923" : "#fff8f5",
    text: isDarkMode ? "#f5f6f9" : "#1f2430",
    subtext: isDarkMode ? "#b5bfce" : "#4b5563",
    accent: "#ff4d4d",
    accentAlt: "#2bb3b1",
    border: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
    heroGradient: isDarkMode
      ? "linear-gradient(140deg, #121520 0%, #1a1f2b 45%, #302027 100%)"
      : "linear-gradient(140deg, #fff5f4 0%, #ffe9de 45%, #e8fbf9 100%)",
    accentSoft: isDarkMode ? "rgba(255,77,77,0.18)" : "rgba(255,77,77,0.12)",
  };

  return {
    palette,
    pageContainer: {
      minHeight: "100vh",
      backgroundColor: palette.bg,
      color: palette.text,
      transition: "background-color 0.3s ease",
      fontFamily: "'Poppins', sans-serif !important",
      "& *": {
        fontFamily: "'Poppins', sans-serif !important",
      },
      "& .MuiTypography-root, & .MuiButton-root, & .MuiChip-root, & .MuiAccordionSummary-root, & .MuiAccordionDetails-root, & .MuiCard-root, & .MuiCardContent-root, & .MuiAvatar-root":
        {
          fontFamily: "'Poppins', sans-serif !important",
        },
    },
    heroSection: {
      position: "relative",
      minHeight: "100vh",
      display: "flex",
      alignItems: "flex-start",
      background: palette.heroGradient,
      overflow: "hidden",
      padding: { xs: "56px 0 48px", md: "72px 0 64px" },
    },
    heroContainer: {
      position: "relative",
      zIndex: 1,
      paddingTop: { xs: "8px", md: "12px" },
    },
    heroGlowOne: {
      position: "absolute",
      width: "420px",
      height: "420px",
      borderRadius: "50%",
      background: isDarkMode ? "rgba(255,77,77,0.2)" : "rgba(255,77,77,0.25)",
      top: "-120px",
      left: "-120px",
      filter: "blur(30px)",
      animation: "floatSoft 12s ease-in-out infinite",
    },
    heroGlowTwo: {
      position: "absolute",
      width: "360px",
      height: "360px",
      borderRadius: "50%",
      background: isDarkMode ? "rgba(43,179,177,0.2)" : "rgba(43,179,177,0.25)",
      bottom: "-160px",
      right: "-120px",
      filter: "blur(30px)",
      animation: "floatSoft 14s ease-in-out infinite",
    },
    heroEyebrow: {
      letterSpacing: "0.3em",
      color: palette.accentAlt,
      fontWeight: 600,
      marginBottom: "4px",
    },
    heroTitle: {
      fontWeight: 600,
      fontSize: { xs: "2.6rem", md: "3.4rem" },
      marginBottom: "6px",
      color: palette.text,
    },
    heroSubtitle: {
      fontSize: { xs: "1.1rem", md: "1.25rem" },
      color: palette.subtext,
      marginBottom: "6px",
    },
    heroBody: {
      color: palette.subtext,
      marginBottom: "10px",
      maxWidth: "540px",
    },
    heroButtons: {
      marginBottom: "8px",
    },
    primaryButton: {
      textTransform: "none",
      fontWeight: 600,
      padding: "12px 26px",
      backgroundColor: palette.accent,
      boxShadow: "0 18px 35px rgba(255,77,77,0.25)",
      "&:hover": {
        backgroundColor: "#ff3333",
      },
    },
    secondaryButton: {
      textTransform: "none",
      fontWeight: 600,
      padding: "12px 26px",
      borderColor: palette.accent,
      color: palette.accent,
      backgroundColor: palette.surface,
      "&:hover": {
        borderColor: "#ff3333",
        backgroundColor: palette.accentSoft,
      },
    },
    ghostButton: {
      textTransform: "none",
      fontWeight: 600,
      color: palette.text,
      "&:hover": {
        backgroundColor: palette.accentSoft,
      },
    },
    heroChips: {
      marginBottom: "6px",
      marginTop: "24px",
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      rowGap: "8px",
      alignItems: "flex-start",
      justifyContent: "flex-start",
      width: "100%",
    },
    heroChip: {
      backgroundColor: palette.accentSoft,
      color: palette.accent,
      fontWeight: 500,
      height: "30px",
      "& .MuiChip-label": {
        padding: "0 12px",
      },
    },
    integrationChips: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      rowGap: "8px",
      alignItems: "flex-start",
      justifyContent: "flex-start",
      width: "100%",
    },
    heroHighlights: {
      marginTop: "0px",
    },
    heroHighlightCard: {
      padding: "12px",
      borderRadius: "12px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-4px)",
        boxShadow: isDarkMode
          ? "0 12px 24px rgba(0,0,0,0.35)"
          : "0 12px 24px rgba(15,23,42,0.12)",
      },
    },
    heroPanel: {
      backgroundColor: palette.surface,
      borderRadius: "20px",
      padding: "28px",
      border: `1px solid ${palette.border}`,
      boxShadow: isDarkMode
        ? "0 24px 60px rgba(0,0,0,0.4)"
        : "0 24px 60px rgba(15,23,42,0.15)",
    },
    heroPanelHeader: {
      marginBottom: "20px",
    },
    panelTitle: {
      fontWeight: 600,
      color: palette.text,
    },
    panelChip: {
      backgroundColor: palette.accentSoft,
      color: palette.accent,
      fontWeight: 500,
    },
    heroMoodList: {
      marginBottom: "20px",
    },
    heroMoodRow: {
      marginBottom: "6px",
    },
    heroProgress: {
      height: "8px",
      borderRadius: "999px",
      backgroundColor: palette.accentSoft,
      "& .MuiLinearProgress-bar": {
        backgroundColor: palette.accent,
      },
    },
    heroDivider: {
      margin: "20px 0",
    },
    heroTrack: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    heroAvatar: {
      width: 36,
      height: 36,
      backgroundColor: palette.accentSoft,
      color: palette.accent,
      fontWeight: 600,
      fontSize: "0.75rem",
    },
    heroPanelFooter: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: "20px",
    },
    section: {
      padding: { xs: "70px 0", md: "100px 0" },
    },
    sectionAlt: {
      padding: { xs: "70px 0", md: "100px 0" },
      backgroundColor: palette.surfaceAlt,
    },
    sectionTitle: {
      textAlign: "center",
      fontWeight: 600,
      fontSize: { xs: "2rem", md: "2.4rem" },
      marginBottom: "12px",
      color: palette.text,
    },
    sectionSubtitle: {
      textAlign: "center",
      maxWidth: "640px",
      margin: "0 auto 36px",
      color: palette.subtext,
    },
    sectionTitleLeft: {
      fontWeight: 600,
      fontSize: { xs: "2rem", md: "2.4rem" },
      marginBottom: "16px",
      color: palette.text,
    },
    sectionSubtitleLeft: {
      marginBottom: "24px",
      color: palette.subtext,
    },
    statsCard: {
      padding: "20px",
      borderRadius: "16px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-6px)",
        boxShadow: isDarkMode
          ? "0 16px 30px rgba(0,0,0,0.35)"
          : "0 16px 30px rgba(15,23,42,0.12)",
      },
    },
    statsValue: {
      fontWeight: 700,
      color: palette.text,
    },
    statLabel: {
      fontWeight: 600,
      color: palette.text,
    },
    statCaption: {
      color: palette.subtext,
    },
    logoSection: {
      padding: { xs: "40px 0 70px", md: "50px 0 80px" },
    },
    logoEyebrow: {
      textAlign: "center",
      display: "block",
      marginBottom: "24px",
      color: palette.subtext,
      letterSpacing: "0.2em",
    },
    logoCard: {
      padding: "14px",
      borderRadius: "12px",
      textAlign: "center",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      fontWeight: 600,
      color: palette.text,
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-4px)",
        boxShadow: isDarkMode
          ? "0 12px 24px rgba(0,0,0,0.35)"
          : "0 12px 24px rgba(15,23,42,0.12)",
      },
    },
    metricsSection: {
      padding: { xs: "70px 0", md: "100px 0" },
      backgroundColor: palette.surfaceAlt,
    },
    megaStatCard: {
      height: "100%",
      borderRadius: "20px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      boxShadow: isDarkMode
        ? "0 20px 40px rgba(0,0,0,0.25)"
        : "0 20px 40px rgba(15,23,42,0.12)",
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-6px)",
        boxShadow: isDarkMode
          ? "0 24px 48px rgba(0,0,0,0.35)"
          : "0 24px 48px rgba(15,23,42,0.18)",
      },
    },
    megaStatValue: {
      fontWeight: 700,
      fontSize: { xs: "2.4rem", md: "3rem" },
      color: palette.accent,
      marginBottom: "8px",
    },
    featureCard: {
      height: "100%",
      borderRadius: "18px",
      padding: "8px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      boxShadow: isDarkMode
        ? "0 20px 40px rgba(0,0,0,0.25)"
        : "0 20px 40px rgba(15,23,42,0.1)",
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-6px)",
        boxShadow: isDarkMode
          ? "0 22px 44px rgba(0,0,0,0.35)"
          : "0 22px 44px rgba(15,23,42,0.16)",
      },
    },
    featureHeader: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      marginBottom: "12px",
    },
    featureTitle: {
      fontWeight: 600,
      color: palette.text,
    },
    featureDescription: {
      color: palette.subtext,
    },
    iconBadge: {
      width: 34,
      height: 34,
      borderRadius: "10px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.accentSoft,
      color: palette.accent,
    },
    pillarCard: {
      height: "100%",
      borderRadius: "18px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-6px)",
        boxShadow: isDarkMode
          ? "0 18px 32px rgba(0,0,0,0.35)"
          : "0 18px 32px rgba(15,23,42,0.12)",
      },
    },
    stepCard: {
      height: "100%",
      borderRadius: "18px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-6px)",
        boxShadow: isDarkMode
          ? "0 18px 32px rgba(0,0,0,0.35)"
          : "0 18px 32px rgba(15,23,42,0.12)",
      },
    },
    stepIcon: {
      width: 36,
      height: 36,
      borderRadius: "10px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.accentSoft,
      color: palette.accent,
      marginBottom: "16px",
    },
    signalHighlight: {
      display: "flex",
      gap: "12px",
      alignItems: "flex-start",
      padding: "12px 0",
    },
    signalCard: {
      borderRadius: "18px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
    },
    signalProgress: {
      height: "8px",
      borderRadius: "999px",
      backgroundColor: palette.accentSoft,
      "& .MuiLinearProgress-bar": {
        backgroundColor: palette.accentAlt,
      },
    },
    useCaseCard: {
      height: "100%",
      borderRadius: "18px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-6px)",
        boxShadow: isDarkMode
          ? "0 18px 32px rgba(0,0,0,0.35)"
          : "0 18px 32px rgba(15,23,42,0.12)",
      },
    },
    journeyCard: {
      height: "100%",
      borderRadius: "18px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-6px)",
        boxShadow: isDarkMode
          ? "0 18px 32px rgba(0,0,0,0.35)"
          : "0 18px 32px rgba(15,23,42,0.12)",
      },
    },
    journeyLabel: {
      color: palette.accentAlt,
      letterSpacing: "0.2em",
    },
    journeyChip: {
      backgroundColor: palette.accentSoft,
      color: palette.accent,
      fontWeight: 500,
    },
    integrationCard: {
      height: "100%",
      borderRadius: "14px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-4px)",
        boxShadow: isDarkMode
          ? "0 14px 26px rgba(0,0,0,0.35)"
          : "0 14px 26px rgba(15,23,42,0.12)",
      },
    },
    enginePoint: {
      display: "flex",
      gap: "12px",
      alignItems: "flex-start",
      padding: "12px 0",
    },
    moodCard: {
      borderRadius: "18px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
    },
    moodProgress: {
      height: "8px",
      borderRadius: "999px",
      backgroundColor: palette.accentSoft,
      "& .MuiLinearProgress-bar": {
        backgroundColor: palette.accent,
      },
    },
    outcomeCard: {
      height: "100%",
      borderRadius: "18px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      boxShadow: isDarkMode
        ? "0 18px 32px rgba(0,0,0,0.25)"
        : "0 18px 32px rgba(15,23,42,0.12)",
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-6px)",
        boxShadow: isDarkMode
          ? "0 18px 32px rgba(0,0,0,0.35)"
          : "0 18px 32px rgba(15,23,42,0.16)",
      },
    },
    outcomeValue: {
      fontWeight: 700,
      fontSize: { xs: "2rem", md: "2.4rem" },
      color: palette.accent,
      marginBottom: "10px",
    },
    trustCard: {
      borderRadius: "18px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
    },
    trustItem: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      padding: "12px",
      borderRadius: "12px",
      backgroundColor: palette.surfaceAlt,
      border: `1px solid ${palette.border}`,
    },
    testimonialCard: {
      height: "100%",
      borderRadius: "18px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-6px)",
        boxShadow: isDarkMode
          ? "0 18px 32px rgba(0,0,0,0.35)"
          : "0 18px 32px rgba(15,23,42,0.12)",
      },
    },
    testimonialAvatar: {
      backgroundColor: palette.accentSoft,
      color: palette.accent,
      fontWeight: 600,
    },
    testimonialText: {
      marginTop: "16px",
      color: palette.subtext,
    },
    planCard: {
      height: "100%",
      borderRadius: "18px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-6px)",
        boxShadow: isDarkMode
          ? "0 18px 32px rgba(0,0,0,0.35)"
          : "0 18px 32px rgba(15,23,42,0.12)",
      },
    },
    planCardHighlight: {
      height: "100%",
      borderRadius: "18px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.accent}`,
      boxShadow: "0 18px 40px rgba(255,77,77,0.2)",
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "&:hover": {
        transform: "translateY(-6px)",
        boxShadow: "0 22px 44px rgba(255,77,77,0.3)",
      },
    },
    planChip: {
      marginBottom: "12px",
      backgroundColor: palette.accentSoft,
      color: palette.accent,
    },
    planPrice: {
      fontWeight: 700,
      margin: "12px 0",
      color: palette.text,
    },
    planBullet: {
      width: 8,
      height: 8,
      borderRadius: "999px",
      backgroundColor: palette.accent,
    },
    faqCard: {
      borderRadius: "16px",
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      boxShadow: "none",
      "&:before": {
        display: "none",
      },
    },
    faqSummary: {
      "& .MuiAccordionSummary-content": {
        margin: "12px 0",
      },
      "& .MuiAccordionSummary-expandIconWrapper": {
        color: palette.accent,
      },
    },
    faqDetails: {
      paddingTop: 0,
      color: palette.subtext,
      opacity: 1,
      visibility: "visible",
    },
    faqAnswer: {
      color: palette.subtext,
      lineHeight: 1.6,
    },
    ctaSection: {
      padding: { xs: "80px 0", md: "110px 0" },
      textAlign: "center",
      background: isDarkMode
        ? "linear-gradient(135deg, #1a1f2b 0%, #2a1d22 100%)"
        : "linear-gradient(135deg, #ffe6e0 0%, #e9fbf9 100%)",
    },
    ctaTitle: {
      fontWeight: 600,
      fontSize: { xs: "2rem", md: "2.6rem" },
      marginBottom: "16px",
      color: palette.text,
    },
    ctaSubtitle: {
      color: palette.subtext,
      marginBottom: "28px",
    },
  };
};

export default LandingPage;
