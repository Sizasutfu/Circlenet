// feed/integratedRanker.js
// ============================================================
//  Integrates the neural ranker with the existing feed pipeline.
//  Can be used alongside or as a replacement for hand-crafted
//  scoring.
// ============================================================

const { getNeuralRanker } = require('./neuralRanker');
const { computeScore, generateReasons } = require('./feedScorer');

class IntegratedRanker {
  constructor() {
    this.neuralRanker = getNeuralRanker();
    this.useNeural = false; // Toggle for A/B testing
    this.neuralEnabled = false;
    this.initialize();
  }

  async initialize() {
    // Try to load neural model
    this.neuralEnabled = await this.neuralRanker.loadModel();
    // If model exists, use it for 50% of users (A/B test)
    // You can set this based on user ID or experiment group
  }

  /**
   * Score posts using either neural or hand-crafted approach
   */
  async scorePosts(posts, context) {
    const viewerUserId = context.viewerUserId;

    // Determine if this user gets neural scoring (A/B test)
    if (this.neuralEnabled && this.shouldUseNeural(viewerUserId)) {
      this.useNeural = true;
      return this.scoreWithNeural(posts, context);
    }

    this.useNeural = false;
    return this.scoreWithHandCrafted(posts, context);
  }

  /**
   * A/B test: use neural for 50% of users based on user ID
   */
  shouldUseNeural(userId) {
    if (!userId) return false;
    // Deterministic split based on user ID
    const hash = this.hashCode(String(userId));
    return hash % 2 === 0;
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * Score posts using neural network
   */
  async scoreWithNeural(posts, context) {
    const scores = await this.neuralRanker.predictBatch(posts, context);

    posts.forEach((post, index) => {
      post._score = scores[index] * 100; // Scale to match hand-crafted range
      post._reasons = generateReasons(post, context);
      post._scoreMethod = 'neural';
    });

    return posts;
  }

  /**
   * Score posts using hand-crafted rules
   */
  scoreWithHandCrafted(posts, context) {
    posts.forEach(post => {
      post._score = computeScore(post, context);
      post._reasons = generateReasons(post, context);
      post._scoreMethod = 'hand-crafted';
    });

    return posts;
  }

  /**
   * Train the neural model with user data
   */
  async trainModel(userId) {
    const trainingData = await this.neuralRanker.collectTrainingData(userId);
    await this.neuralRanker.train(trainingData);
    await this.neuralRanker.saveModel();
    this.neuralEnabled = true;
  }
}

module.exports = { IntegratedRanker };