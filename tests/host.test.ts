import {afterEach, describe, expect, it, vi} from "vitest";
import {UpuautRouter} from "../src/components/router-element";
import {UpuautView} from "../src/components/view";
import {createMemoryHistory} from "../src/history";
import {createRouter} from "../src/router";

// This file defines <upuaut-view> before <upuaut-router> on purpose, to cover
// the "host not upgraded yet" path of connectRouter().
afterEach(() => document.body.replaceChildren());

describe("connectRouter before the host is defined", () => {
  it("waits for the definition and skips views removed meanwhile", async () => {
    UpuautView.fire();
    const host = document.createElement("upuaut-router");
    host.innerHTML = "<upuaut-view id='kept'></upuaut-view><upuaut-view id='gone'></upuaut-view>";
    document.body.append(host);
    const gone = host.querySelector("#gone")!;
    gone.remove();
    const back = host.querySelector("#kept")!.cloneNode() as Element;
    back.id = "back";
    host.append(back);
    // Reconnected before the definition: only its newest wait may attach.
    host.append(gone);
    gone.remove();
    host.append(gone);
    const onRouter = vi.spyOn(UpuautRouter.prototype, "onRouter");

    const router = createRouter({
      history: createMemoryHistory("/"),
      routes: [{path: "/", component: "test-home"}],
    });
    UpuautRouter.fire();
    await customElements.whenDefined("upuaut-router");
    (host as UpuautRouter).router = router;
    await router.isReady();
    await Promise.resolve();

    expect(host.querySelector("#kept test-home")).not.toBeNull();
    expect(host.querySelector("#gone test-home")).not.toBeNull();
    expect(onRouter).toHaveBeenCalledTimes(3);
    onRouter.mockRestore();
  });

  it("finds the host across a shadow root", async () => {
    const router = createRouter({
      history: createMemoryHistory("/"),
      routes: [{path: "/", component: "test-shadow-home"}],
    });
    const host = document.createElement("upuaut-router") as UpuautRouter;
    const wrapper = document.createElement("div");
    const shadow = wrapper.attachShadow({mode: "open"});
    shadow.innerHTML = "<upuaut-view></upuaut-view>";
    host.append(wrapper);
    document.body.append(host);
    host.router = router;
    await router.isReady();
    expect(shadow.querySelector("test-shadow-home")).not.toBeNull();
  });
});
