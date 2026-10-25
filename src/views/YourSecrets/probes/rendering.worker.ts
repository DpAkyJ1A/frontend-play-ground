import { render } from './rendering';

type WorkerNavigator = { gpu?: Parameters<typeof render>[1] };

self.onmessage = async () => {
  try {
    self.postMessage(
      await render(
        () => new OffscreenCanvas(1, 1),
        (self.navigator as unknown as WorkerNavigator).gpu
      )
    );
  } catch {
    self.postMessage(null);
  }
};
