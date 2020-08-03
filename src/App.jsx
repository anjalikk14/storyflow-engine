// The parent component for the entire app

import React, {
  useRef,
  createContext,
  useState,
  useEffect,
  useContext,
  useReducer
} from "react";

import "./App.css";

// The holder for the current room state.
const GameState = ({ roomSchemas }) => {
  const [schemas, setSchemas] = useState({});
  const [roomStates, setRoomStates] = useState({});
  const [inventory, setInventory] = useState({});
  const [currentRoomId, setCurrentRoomId] = useState();

  useEffect(() => {
    console.log(inventory);
  }, [inventory]);

  function setInventoryFn(key, value) {
    setInventory({ ...inventory, [key]: value });
  }

  function setRoomStatesFn(roomKey, key, value) {
    setRoomStates({
      ...roomStates,
      [roomKey]: { ...roomStates[roomKey], [key]: value }
    });
  }

  // Construct the rooms object from the schemas. This runs once, on
  // initialization of the game state.
  useEffect(() => {
    console.log("Calling room schemas");
    let startingRoom;
    let localSchemas = {};
    for (const idx in roomSchemas) {
      const schema = roomSchemas[idx];
      localSchemas[schema.name] = schema;
      if (schema.startHere) startingRoom = schema.name;
    }

    if (!startingRoom) {
      alert("ERROR: no starting room found!");
      return;
    }

    setSchemas(localSchemas);
    setCurrentRoomId(startingRoom);
  }, roomSchemas);

  return Object.keys(schemas).length ? (
    <Room
      schema={schemas[currentRoomId]}
      setCurrentRoomId={setCurrentRoomId}
      setInventoryFn={setInventoryFn}
      inventory={inventory}
      setRoomStatesFn={setRoomStatesFn}
      roomState={roomStates[currentRoomId] ? roomStates[currentRoomId] : {}}
    />
  ) : null;
};

// Helper function. A smart number: if the passed in value isn't numeric,
// returns 0.
function smartNum(maybeNumber) {
  return !isNaN(parseFloat(maybeNumber)) && isFinite(maybeNumber)
    ? maybeNumber
    : 0;
}

// A component for an individual room. Doubles as a compiler for the passed in
// schema.
const Room = ({
  schema,
  setCurrentRoomId,
  setInventoryFn,
  inventory,
  setRoomStatesFn,
  roomState
}) => {
  const iframeRef = useRef(null);

  const handleIframeMessage = ({ data }) => {
    if (!data.action) {
      alert("ERROR: got data without any action set.");
      console.log(data);
      return;
    }

    // TODO(anjali): Add error checking for types here.
    if (data.action === "CHANGEROOM") {
      setCurrentRoomId(data.room);
    } else if (data.action === "SETINVENTORY") {
      setInventoryFn(data.key, data.value);
    } else if (data.action === "DELETEINVENTORY") {
      setInventoryFn(data.key, undefined);
    } else if (data.action === "INCREMENTINVENTORY") {
      setInventoryFn(data.key, smartNum(inventory[data.key]) + 1);
    } else if (data.action === "DECREMENTINVENTORY") {
      setInventoryFn(data.key, smartNum(inventory[data.key]) - 1);
    } else if (data.action === "SETROOMSTATE") {
      setRoomStatesFn(schema.name, data.key, data.value);
    } else if (data.action === "DELETEROOMSTATE") {
      setRoomStatesFn(schema.name, data.key, undefined);
    } else if (data.action === "INCREMENTROOMSTATE") {
      setRoomStatesFn(schema.name, data.key, smartNum(roomState[data.key]) + 1);
    } else if (data.action === "DECREMENTROOMSTATE") {
      setRoomStatesFn(schema.name, data.key, smartNum(roomState[data.key]) - 1);
    }
  };

  // Setup message retrieval from the iframe.
  //
  // In order to communicate with our iframe, we need to add event listeners to
  // the window. These event listeners need to change each time state changes,
  // i.e. on rerender. We can't keep adding event listeners -- js doesn't
  // override the previous message listeners. So on cleanup, we have to return a
  // function that removes the event listener we just added.
  useEffect(() => {
    window.addEventListener("message", handleIframeMessage, true);
    return () => {
      window.removeEventListener("message", handleIframeMessage, true);
    };
  });

  // Set up the html for the room.
  //
  // Add in some common functions that allow the room to interact with the
  // global and room level state. These functions and variables can be used like
  // an API by the end developer.
  //
  // NOTE: we do not have any 'get' operations for global and room state vars,
  // only 'set' operations. Instead, the global/roomstate variables are set
  // once (at the beginning of the room) and then updated inline like normal
  // js objects. This is done because there is no way to get callbacks from a
  // postMessage event -- it's not a socket. However, this means there MAY be
  // edge cases where the local state and the actual external state aren't
  // exactly aligned.
  //
  // Current client API:
  // FUNCTIONS.
  //	toRoom(String): transitions to a new room with name = passed in string.
  //  setInventory(String, Obj): adds Obj to inventory with key String in
  //		inventory.
  //  deleteInventory(String, Obj): sets key String to undefined in inventory.
  //  incrementInventory(String): sets key String to 1 or adds 1 to value at key
  //		String in inventory.
  //  decrementInventory(String): sets key String to -1 or subtracts 1 to value
  //		at key String in inventory.
  //	{set, delete, increment, decrement}RoomState(String, Obj): see Inventory
  //		equivalents.
  //
  // VARIABLES.
  //	roomState: a local state for the room. Only accessible by this room.
  //	inventory: a global state, accessible across rooms.
  const roomHTML =
    `
		<script>
				const parentURI = '${window.location.origin}';
				let roomState = JSON.parse('${JSON.stringify(roomState)}');
				let inventory = JSON.parse('${JSON.stringify(inventory)}');

				function smartNum(maybeNumber) {
					return !isNaN(parseFloat(maybeNumber)) && isFinite(maybeNumber)
						? maybeNumber
						: 0;
				}

				function toRoom(room) {
					window.parent.postMessage({action: 'CHANGEROOM', room: room});
				}

				function setInventory(key, value) {
					window.parent.postMessage({
						action: 'SETINVENTORY', key: key, value: value
					}, parentURI);
					inventory[key] = value;
				}

				function deleteInventory(key) {
					window.parent.postMessage({
						action: 'DELETEINVENTORY', key: key
					}, parentURI);
					inventory[key] = undefined;
				}

				function incrementInventory(key) {
					window.parent.postMessage({
						action: 'INCREMENTINVENTORY', key: key
					}, parentURI);
					inventory[key] = smartNum(inventory[key]) + 1;
				}

				function decrementInventory(key) {
					window.parent.postMessage({
						action: 'DECREMENTINVENTORY', key: key
					}, parentURI);
					inventory[key] = smartNum(inventory[key]) - 1;
				}

				function setRoomState(key, value) {
					console.log(key, value);
					window.parent.postMessage({
						action: 'SETROOMSTATE', key: key, value: value
					}, parentURI);
					roomState[key] = value;
				}

				function deleteRoomState(key) {
					window.parent.postMessage({
						action: 'SETROOMSTATE', key: key
					}, parentURI);
					roomState[key] = undefined;
				}

				function incrementRoomState(key) {
					window.parent.postMessage({
						action: 'SETROOMSTATE', key: key
					}, parentURI);
					roomState[key] = smartNum(roomState[key]) + 1;
				}

				function decrementRoomState(key) {
					window.parent.postMessage({
						action: 'SETROOMSTATE', key: key
					}, parentURI);
					roomState[key] = smartNum(roomState[key]) - 1;
				}
			</script>
	` + schema.html;
  return (
    <div>
      <iframe ref={iframeRef} title="currentRoom" srcDoc={roomHTML} />
    </div>
  );
};

function App() {
  const roomSchemas = [
    {
      name: "Room One",
      html: `
			<style>
				.green {
					color: green;
				}
			</style>
			<div>
				<span class="green"> Whoa </span> this is html in room one!
			</div>
			<div onclick="toRoom('Room Two')"> Go to room two! </div>
			<div onclick="toRoom('Room Three')"> Go to room three! </div>
			<div onclick="setInventory('shinyKey', true)"> Get shiny key! </div>
			<div onclick="setInventory('dullKey', true)"> Get dull key! </div>
			`,
      startHere: true
    },
    {
      name: "Room Two",
      html: `
			<div>
				Whoa this is html in room two! Not green though.
			</div>
			<div onclick="toRoom('Room One')"> Go to room one! </div>
			<div onclick="toRoom('Room Three')"> Go to room three! </div>
			<div onclick="console.log(inventory)"> Check backpack! </div>
			`
    },
    {
      name: "Room Three",
      html: `
			<script>
				function addRandomToRoomState() {
					setRoomState(Math.random(), Math.random());
				}
			</script>
			<div> Man, room three sucks. </div>
			<div onclick="toRoom('Room One')"> Go to room one! </div>
			<div onclick="toRoom('Room Two')"> Go to room two! </div>
			<div onclick="addRandomToRoomState()"> Add to room state! </div>
			<div onclick="console.log(roomState)"> Get room state! </div>
			`
    }
  ];

  return <GameState roomSchemas={roomSchemas} />;
}

export default App;
