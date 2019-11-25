import { describe, it } from "mocha";
import { chai } from "./chai";
import { Exception } from "../lib";

const { expect } = chai;

describe("exception spec", () => {
  it("creates exception", () => {
    const emitter = "emitter";
    const code = "CODE";
    const message = "message";
    const data = {};
    const e = new Exception(emitter, code, message, data);
    expect(e.name).to.be.equal("Exception");
    expect(e.data).to.be.deep.equal(data);
  });

  it("returns string representation", () => {
    const emitter = "emitter";
    const code = "CODE";
    const message = "message";
    const data = {};
    const e = new Exception(emitter, code, message, data);
    expect(e.toString()).to.be.equal(`[${emitter}] ${code}: ${message}`);
  });
});
