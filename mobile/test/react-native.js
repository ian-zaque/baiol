const React = require('react');

function host(name) {
  function Host(props) {
    return React.createElement(name, props, props.children);
  }
  Host.displayName = name;
  return Host;
}

module.exports = {
  StyleSheet: {
    absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    create: (styles) => styles,
    flatten: (style) => style,
  },
  View: host('View'),
  Text: host('Text'),
  TextInput: host('TextInput'),
  Pressable: host('Pressable'),
  ScrollView: host('ScrollView'),
  ActivityIndicator: host('ActivityIndicator'),
  KeyboardAvoidingView: host('KeyboardAvoidingView'),
  Modal: host('Modal'),
  Platform: { OS: 'ios', select: (options) => options.ios ?? options.default },
};
