export const findPeaks = (x, height, prominence, distance) => {
  if (distance !== null && distance < 1) {
    throw new Error('`distance` must be greater or equal to 1');
  }

  var properties

  var peaks = _localMaxima1d(x)
  
  if (height !== null && height !== undefined) {
    const peakHeights = peaks.map(v => x[v])
    const keep = _selectByProperty(peakHeights, height)
    peaks = peaks.filter((_, i) => keep[i])
  }

  if (prominence !== null && prominence !== undefined) {
    properties = _peakProminences(x, peaks, -1)
    let pMin = null, pMax = null
    if (typeof prominence === "number" || prominence.length == 1) {
      pMin = prominence
    } else if (prominence.length >= 2) {
      pMin = prominence[0]
      pMax = prominence[1]
    }
    const keep = _selectByProperty(properties.prominences, pMin, pMax)
    peaks = peaks.filter((_, i) => keep[i])
  }

  if (distance !== null && distance !== undefined) {
    const keep = _selectByPeakDistance(peaks, peaks.map(v => x[v]), distance)
    peaks = peaks.filter((_, i) => keep[i])
  }

  return {peaks, properties}
}

const _localMaxima1d = (x) => {
  const maximaIndices = [];

  for (let i = 1; i < x.length - 1; i++) {
    if (x[i] > x[i - 1] && x[i] > x[i + 1]) {
      maximaIndices.push(i); 
    }
  }

  return maximaIndices;
}

const _selectByProperty = (peakProperties, pmin, pmax) => {
  // Create a boolean mask initialized to true for all elements
  let keep = new Array(peakProperties.length).fill(true);

  if (pmin !== null && pmin !== undefined) {
    keep = keep.map((val, i) => val && (pmin <= peakProperties[i]));
  }
  
  if (pmax !== null && pmax !== undefined) {
    keep = keep.map((val, i) => val && (peakProperties[i] <= pmax));
  }

  return keep;
}

const _peakProminences = (x, peaks, wlen) => {
  if (!Array.isArray(x) || !Array.isArray(peaks)) {
      throw new Error("Invalid input: x and peaks must be arrays");
  }
  
  let prominences = new Array(peaks.length).fill(0);
  let leftBases = new Array(peaks.length).fill(0);
  let rightBases = new Array(peaks.length).fill(0);
  let showWarning = false;

  for (let peakNr = 0; peakNr < peaks.length; peakNr++) {
      let peak = peaks[peakNr];
      let iMin = 0;
      let iMax = x.length - 1;

      if (peak < iMin || peak > iMax) {
          throw new Error(`peak ${peak} is not a valid index for x`);
      }

      if (wlen >= 2) {
          iMin = Math.max(peak - Math.floor(wlen / 2), iMin);
          iMax = Math.min(peak + Math.floor(wlen / 2), iMax);
      }

      // Find the left base
      let i = peak;
      leftBases[peakNr] = peak;
      let leftMin = x[peak];
      while (i >= iMin && x[i] <= x[peak]) {
          if (x[i] < leftMin) {
              leftMin = x[i];
              leftBases[peakNr] = i;
          }
          i--;
      }

      // Find the right base
      i = peak;
      rightBases[peakNr] = peak;
      let rightMin = x[peak];
      while (i <= iMax && x[i] <= x[peak]) {
          if (x[i] < rightMin) {
              rightMin = x[i];
              rightBases[peakNr] = i;
          }
          i++;
      }

      prominences[peakNr] = x[peak] - Math.max(leftMin, rightMin);
      if (prominences[peakNr] === 0) {
          showWarning = true;
      }
  }

  if (showWarning) {
      console.warn("Some peaks have a prominence of 0");
  }

  return { prominences, leftBases, rightBases };
}

const _selectByPeakDistance = (peaks, priority, distance) => {
  if (!Array.isArray(peaks) || !Array.isArray(priority)) {
      throw new Error("Invalid input: peaks and priority must be arrays");
  }
  if (peaks.length !== priority.length) {
      throw new Error("peaks and priority arrays must have the same length");
  }
  
  let peaksSize = peaks.length;
  let distance_ = Math.ceil(distance);
  let keep = new Array(peaksSize).fill(true);
  
  // Create mapping from priority order to position order
  let priorityToPosition = [...priority.keys()].sort((a, b) => priority[a] - priority[b]);
  
  // Iterate in reverse order (highest priority first)
  for (let i = peaksSize - 1; i >= 0; i--) {
      let j = priorityToPosition[i];
      if (!keep[j]) continue; // Skip already removed peaks
      
      let k = j - 1;
      while (k >= 0 && peaks[j] - peaks[k] < distance_) {
          keep[k] = false;
          k--;
      }
      
      k = j + 1;
      while (k < peaksSize && peaks[k] - peaks[j] < distance_) {
          keep[k] = false;
          k++;
      }
  }
  
  return keep;
}