# 3D Visualization Modes Guide

## 🎨 5 Novel 3D Visualization Modes

Press **M** key to cycle through these modes:

---

### 1. **Stacked Curves** (Default)
- Classic side-by-side waveform view
- Each slice is a smooth curve
- **Animation:** Playing slices pulse and glow in bright green
- Best for: Seeing individual waveform shapes clearly

---

### 2. **3D Surface**
- Continuous mesh connecting all slices
- Creates a flowing 3D terrain
- **Animation:** Surface sections light up when playing
- Best for: Understanding relationships between slices
- Uses quad strips for smooth geometry

---

### 3. **Bar Graph**
- Vertical 3D bars like a histogram
- Each waveform sample becomes a box
- **Animation:** Bars grow/shrink with pulsing effect
- Best for: Amplitude visualization and rhythm
- Most "musical" looking mode

---

### 4. **Spiral Radial**
- Waveforms arranged in concentric circles
- Each slice spirals outward from center
- **Animation:** Rings pulse and expand when playing
- Best for: Cyclical/looping visualization
- Creates mesmerizing mandala patterns

---

### 5. **Extruded Ribbons**
- Solid filled ribbon shapes
- Thick 3D geometry with depth
- **Animation:** Ribbons glow and pulse intensely
- Best for: Bold, theatrical presentation
- Most visually dramatic mode

---

## 🎭 Animation Features

All modes include:
- ✨ **Pulsing effect** when slice is playing (sine wave animation)
- 🎨 **Color change** from blue → bright green
- 📏 **Scale changes** synchronized to playback
- ⏱️ **Timing:** 400-600ms cycles for smooth visual rhythm

---

## 🎹 How to Use

1. **Capture face** (C key)
2. **Toggle to wavetable view** (V key)
3. **Press number keys 1-9** to play slices
4. **Watch the animation!** Playing slice lights up
5. **Press M** to cycle visualization modes
6. **Rotate camera** with mouse to explore 3D space

---

## 💡 Pro Tips

- **Video preview hidden** in wavetable mode for cleaner view
- **Mouth-aligned slice** shows in blue in all modes
- **Playing slices** always show in bright green
- Use **mouse wheel** to zoom in on specific modes
- **Spiral mode** looks best with 8-12 slices
- **Surface mode** needs at least 4 slices to render properly

---

## 🔧 Technical Details

- All modes use p5.js WEBGL renderer
- Animation uses `millis()` for smooth timing
- Pulsing implemented with `sin(t * TWO_PI)`
- Performance optimized with `step` sampling
- Colors: Blue (idle), Green (playing), Light blue (default)

---

## 🎵 Recommended Combinations

1. **Bars + X-axis**: Best for rhythmic patterns
2. **Spiral + Y-axis**: Creates flowing circular motion  
3. **Surface + many slices (16+)**: Beautiful terrain
4. **Extrude + low slice count (6-8)**: Bold ribbons
5. **Curves**: Classic, always works well

Enjoy exploring! 🚀
