import type { Probe } from './types';
import ai from './ai';
import allFonts from './allFonts';
import automation from './automation';
import battery from './battery';
import behaviour from './behaviour';
import bluetooth from './bluetooth';
import browserWindow from './browserWindow';
import clipboard from './clipboard';
import codecs from './codecs';
import contacts from './contacts';
import deviceNames from './deviceNames';
import devices from './devices';
import display from './display';
import docs from './docs';
import drm from './drm';
import engine from './engine';
import extensions from './extensions';
import extras from './extras';
import eyedropper from './eyedropper';
import fingerprint from './fingerprint';
import folder from './folder';
import fonts from './fonts';
import gamepad from './gamepad';
import graphics from './graphics';
import hardware from './hardware';
import hid from './hid';
import idle from './idle';
import input from './input';
import ip from './ip';
import load from './load';
import locale from './locale';
import location from './location';
import midi from './midi';
import motion from './motion';
import network from './network';
import passkeys from './passkeys';
import permissions from './permissions';
import photo from './photo';
import preferences from './preferences';
import privacy from './privacy';
import release from './release';
import screens from './screens';
import screenShare from './screenShare';
import serial from './serial';
import server from './server';
import sound from './sound';
import storage from './storage';
import system from './system';
import text from './text';
import usb from './usb';
import visit from './visit';
import voices from './voices';

export const PROBES: Probe[] = [
  locale,
  system,
  release,
  engine,
  ai,
  graphics,
  display,
  browserWindow,
  text,
  hardware,
  preferences,
  fonts,
  fingerprint,
  storage,
  network,
  load,
  server,
  ip,
  battery,
  privacy,
  permissions,
  extensions,
  automation,
  devices,
  passkeys,
  codecs,
  drm,
  voices,
  input,
  extras,
  visit,
  behaviour,
  clipboard,
  sound,
  photo,
  docs,
  gamepad,
  eyedropper,
  location,
  deviceNames,
  screens,
  allFonts,
  folder,
  screenShare,
  idle,
  motion,
  bluetooth,
  usb,
  hid,
  serial,
  midi,
  contacts,
];
