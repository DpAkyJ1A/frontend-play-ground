import Sheet from '../Sheet';

export type AboutProps = {
  open: boolean;
  onClose: () => void;
};

export default function About({ open, onClose }: AboutProps) {
  return (
    <Sheet open={open} onClose={onClose} title="About Your Secrets">
      <p>
        Every site you open can read a lot about you before you click anything.
        This page collects what your browser hands over on its own and lays it
        out card by card. Whatever needs a click or a permission waits for your
        button.
      </p>
      <h3>Nothing leaves this tab</h3>
      <p>
        Everything is worked out in your browser and forgotten when you close
        it. No trackers, no third-party APIs, no keys. The site only counts page
        views, without cookies.
      </p>
      <p>
        The one exception is your IP address. To show where it places you, the
        page asks this site’s own server, which reads it from the request,
        answers and stores nothing.
      </p>
    </Sheet>
  );
}
