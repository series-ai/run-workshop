// Physical lamp data from the frozen R43 source.
export const R44_LAMP_PROFILES = [
  {
    "name": "cab",
    "front": {
      "kind": "pair",
      "centreXM": 0.56,
      "yM": -0.04,
      "zM": 2.61,
      "widthM": 0.5,
      "heightM": 0.3
    },
    "rear": {
      "kind": "bar",
      "centreXM": 0,
      "yM": 0.1,
      "zM": -2.21,
      "widthM": 1.75,
      "heightM": 0.2
    }
  },
  {
    "name": "interceptor",
    "front": {
      "kind": "bar",
      "centreXM": 0,
      "yM": 0.06,
      "zM": 3.14,
      "widthM": 0.9,
      "heightM": 0.12
    },
    "rear": {
      "kind": "bar",
      "centreXM": 0,
      "yM": -0.02,
      "zM": -2.97,
      "widthM": 1.4,
      "heightM": 0.16
    }
  },
  {
    "name": "commuter",
    "front": {
      "kind": "pair",
      "centreXM": 0.35,
      "yM": -0.18,
      "zM": 3.01,
      "widthM": 0.32,
      "heightM": 0.2
    },
    "rear": {
      "kind": "bar",
      "centreXM": 0,
      "yM": -0.26,
      "zM": -2.11,
      "widthM": 1.5,
      "heightM": 0.2
    }
  },
  {
    "name": "van",
    "front": {
      "kind": "pair",
      "centreXM": 0.7,
      "yM": -0.1,
      "zM": 2.31,
      "widthM": 0.45,
      "heightM": 0.25
    },
    "rear": {
      "kind": "bar",
      "centreXM": 0,
      "yM": 1.05,
      "zM": -2.11,
      "widthM": 1.9,
      "heightM": 0.18
    }
  },
  {
    "name": "bus",
    "front": {
      "kind": "pair",
      "centreXM": 0.75,
      "yM": -0.3,
      "zM": 4.12,
      "widthM": 0.5,
      "heightM": 0.3
    },
    "rear": {
      "kind": "bar",
      "centreXM": 0,
      "yM": 0.3,
      "zM": -4.12,
      "widthM": 2,
      "heightM": 0.22
    }
  },
  {
    "name": "flatbed",
    "front": {
      "kind": "bar",
      "centreXM": 0,
      "yM": 0.1,
      "zM": 3.56,
      "widthM": 1.7,
      "heightM": 0.18
    },
    "rear": {
      "kind": "bar",
      "centreXM": 0,
      "yM": -0.35,
      "zM": -4.21,
      "widthM": 2.1,
      "heightM": 0.16
    }
  }
] as const;
