module.exports = api => {
  api.cache(true);
  return {
    presets: [
      // Pin the @babel/runtime version so runtime helpers are imported once
      // from @babel/runtime instead of being inlined (and duplicated) per file.
      ['module:@react-native/babel-preset', { enableBabelRuntime: '^7.25.0' }],
    ],
    plugins: [
      // React Compiler must run before other plugins.
      ['babel-plugin-react-compiler', { target: '19' }],
      // The worklets plugin must remain last.
      'react-native-worklets/plugin',
    ],
  };
};
