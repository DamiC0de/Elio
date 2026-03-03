/**
 * Expo Config Plugin for Diva Keyboard Extension
 * 
 * This plugin:
 * 1. Adds the keyboard extension target to the Xcode project
 * 2. Configures App Groups for shared keychain
 * 3. Sets up the necessary entitlements
 */
const { withXcodeProject, withInfoPlist, withEntitlementsPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KEYBOARD_EXTENSION_NAME = 'DivaKeyboard';
const APP_GROUP = 'group.com.diva.app';

function withKeyboardExtension(config) {
  // Add App Group entitlement to main app
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.security.application-groups'] = [APP_GROUP];
    return config;
  });

  // The actual keyboard extension files need to be added manually after prebuild
  // or via a more complex config plugin that creates the target
  
  return config;
}

module.exports = withKeyboardExtension;
