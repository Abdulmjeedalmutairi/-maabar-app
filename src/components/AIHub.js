import React, { useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Platform, PanResponder, Animated, Dimensions,
} from 'react-native';
import { C } from '../lib/colors';
import { F } from '../lib/fonts';

const { width: SW, height: SH } = Dimensions.get('window');
const FAB_SIZE  = 44;
const MARGIN    = 20;
const BOTTOM_CLEARANCE = Platform.OS === 'ios' ? 120 : 100; // above tab bar

const INIT_X = SW - FAB_SIZE - MARGIN;
const INIT_Y = SH - FAB_SIZE - BOTTOM_CLEARANCE;

export default function AIHub({ goTo }) {
  const [open, setOpen] = useState(false);

  // Animated position (top-left origin)
  const pan     = useRef(new Animated.ValueXY({ x: INIT_X, y: INIT_Y })).current;
  const lastPos = useRef({ x: INIT_X, y: INIT_Y });
  const dragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      // Claim the gesture immediately so we catch both taps and drags
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: () => {
        // Offset from last settled position so movement is relative
        pan.setOffset(lastPos.current);
        pan.setValue({ x: 0, y: 0 });
        dragging.current = false;
      },

      onPanResponderMove: (_, g) => {
        // Mark as drag once the finger moves more than a few pixels
        if (Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5) {
          dragging.current = true;
        }
        pan.setValue({ x: g.dx, y: g.dy });
      },

      onPanResponderRelease: (_, g) => {
        pan.flattenOffset();

        if (!dragging.current) {
          // Short tap — reset position animation and open the sheet
          pan.setValue(lastPos.current);
          setOpen(true);
          return;
        }

        // Compute final position, clamped to screen bounds
        const rawX     = lastPos.current.x + g.dx;
        const rawY     = lastPos.current.y + g.dy;
        const clampedY = Math.max(40, Math.min(SH - FAB_SIZE - 80, rawY));

        // Snap to nearest horizontal edge
        const snapX = rawX + FAB_SIZE / 2 < SW / 2
          ? MARGIN
          : SW - FAB_SIZE - MARGIN;

        const dest = { x: snapX, y: clampedY };
        lastPos.current = dest;

        Animated.spring(pan, {
          toValue: dest,
          useNativeDriver: false,
          tension: 120,
          friction:  8,
        }).start();
      },

      // Don't give up the responder once acquired
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  function go(type) {
    setOpen(false);
    setTimeout(() => {
      goTo?.(type === 'assistant' ? 'IdeaToProduct' : 'CalcTool');
    }, 250);
  }

  return (
    <>
      {/* Draggable FAB */}
      <Animated.View
        style={[s.fab, { left: pan.x, top: pan.y }]}
        {...panResponder.panHandlers}
      >
        <Text style={s.fabText}>AI</Text>
        <View style={s.dot} />
      </Animated.View>

      {/* Bottom sheet */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={s.overlay}>
            <TouchableWithoutFeedback>
              <View style={s.sheet}>
                <View style={s.handle} />
                <Text style={s.sheetTitle}>أدوات معبر</Text>

                <TouchableOpacity style={s.option} activeOpacity={0.75} onPress={() => go('assistant')}>
                  <Text style={s.optIcon}>◎</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optTitle}>مساعد معبر</Text>
                    <Text style={s.optSub}>يفهم فكرتك، يخدمك، ويرتب طلبك</Text>
                  </View>
                  <Text style={s.optArrow}>←</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.option} activeOpacity={0.75} onPress={() => go('calc')}>
                  <Text style={s.optIcon}>◈</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optTitle}>الحاسبة</Text>
                    <Text style={s.optSub}>تكلفة · شحن · ربح</Text>
                  </View>
                  <Text style={s.optArrow}>←</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
    // Subtle shadow so the button reads over any background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: F.enSemi,
    letterSpacing: 0.5,
  },
  dot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4caf6e',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.88)',
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.bgBase,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.borderDefault,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: F.arBold,
    fontSize: 13,
    color: C.textTertiary,
    textAlign: 'right',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  optIcon:  { fontSize: 20, color: C.textSecondary, fontFamily: F.en },
  optTitle: {
    fontFamily: F.arBold,
    fontSize: 15,
    color: C.textPrimary,
    textAlign: 'right',
    marginBottom: 3,
  },
  optSub: {
    fontFamily: F.ar,
    fontSize: 12,
    color: C.textTertiary,
    textAlign: 'right',
    lineHeight: 18,
  },
  optArrow: { color: C.textDisabled, fontSize: 16, fontFamily: F.en },
});
