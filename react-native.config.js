const path = require('path');

/**
 * The object detector lives in this repo at modules/react-native-face-recognition
 * and is reached via a workspace symlink in node_modules. Left to its own devices,
 * CocoaPods declares the pod at the symlink but resolves its sources through the
 * real path, which makes Xcode render two mismatched "Development Pods" groups
 * full of ../.. chains. Pointing the dependency root at the real directory keeps
 * both sides consistent and gives a single clean group.
 *
 * @type {import('@react-native-community/cli-types').Config}
 */
module.exports = {
  dependencies: {
    'react-native-vision-camera-face-recognizer': {
      root: path.join(__dirname, 'modules', 'react-native-face-recognition'),
    },
  },
};
