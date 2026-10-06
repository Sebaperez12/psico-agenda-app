import test from "node:test";
import assert from "node:assert/strict";
import { getPostLoginTarget, updateOfficeAddressList } from "./profileFlow.js";

test("un usuario sin perfil va al perfil y no queda atrapado en una redirección de registro", () => {
  assert.equal(getPostLoginTarget({ has_profile: false }), "/profile");
});

test("un usuario con perfil entra directamente a la agenda", () => {
  assert.equal(getPostLoginTarget({ has_profile: true }), "/appointments");
});

test("una dirección nueva se conserva sin mover las direcciones anteriores", () => {
  assert.deepEqual(updateOfficeAddressList(["Calle 1", "Calle 2", "", "", ""], "Calle 3"), [
    "Calle 3",
    "Calle 1",
    "Calle 2",
    "",
    "",
  ]);
});

test("si la nueva dirección ya existe, no se duplica", () => {
  assert.deepEqual(updateOfficeAddressList(["Calle 1", "Calle 2", "", "", ""], "Calle 2"), [
    "Calle 2",
    "Calle 1",
    "",
    "",
    "",
  ]);
});
