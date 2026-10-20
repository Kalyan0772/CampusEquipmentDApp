// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EquipmentLending {

    address public owner;
    uint256 private nextEquipmentId = 1;

    struct Equipment {
        uint256 id;
        string name;
        string category;
        bool available;
        address borrower;
    }

    struct BorrowRecord {
        uint256 equipmentId;
        address borrower;
        uint256 borrowedAt;
        uint256 returnedAt;
        bool returned;
    }

    mapping(uint256 => Equipment) public equipment;
    mapping(uint256 => BorrowRecord[]) private borrowHistory;

    event EquipmentRegistered(
        uint256 indexed equipmentId,
        string name,
        string category
    );

    event EquipmentBorrowed(
        uint256 indexed equipmentId,
        address indexed borrower,
        uint256 timestamp
    );

    event EquipmentReturned(
        uint256 indexed equipmentId,
        address indexed borrower,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerEquipment(
        string memory _name,
        string memory _category
    ) public onlyOwner {
        require(bytes(_name).length > 0, "Equipment name required");
        require(bytes(_category).length > 0, "Category required");

        equipment[nextEquipmentId] = Equipment(
            nextEquipmentId,
            _name,
            _category,
            true,
            address(0)
        );

        emit EquipmentRegistered(
            nextEquipmentId,
            _name,
            _category
        );

        nextEquipmentId++;
    }

    function borrowEquipment(uint256 _equipmentId) public {
        require(
            _equipmentId > 0 && _equipmentId < nextEquipmentId,
            "Equipment does not exist"
        );

        Equipment storage item = equipment[_equipmentId];

        require(item.available, "Equipment is not available");

        item.available = false;
        item.borrower = msg.sender;

        borrowHistory[_equipmentId].push(
            BorrowRecord(
                _equipmentId,
                msg.sender,
                block.timestamp,
                0,
                false
            )
        );

        emit EquipmentBorrowed(
            _equipmentId,
            msg.sender,
            block.timestamp
        );
    }

    function returnEquipment(uint256 _equipmentId) public {
        require(
            _equipmentId > 0 && _equipmentId < nextEquipmentId,
            "Equipment does not exist"
        );

        Equipment storage item = equipment[_equipmentId];

        require(!item.available, "Equipment is already available");

        require(
            item.borrower == msg.sender,
            "Only the borrower can return this equipment"
        );

        item.available = true;
        item.borrower = address(0);

        uint256 historyLength = borrowHistory[_equipmentId].length;

        borrowHistory[_equipmentId][historyLength - 1].returned = true;
        borrowHistory[_equipmentId][historyLength - 1].returnedAt =
            block.timestamp;

        emit EquipmentReturned(
            _equipmentId,
            msg.sender,
            block.timestamp
        );
    }

    function getEquipment(
        uint256 _equipmentId
    )
        public
        view
        returns (
            uint256,
            string memory,
            string memory,
            bool,
            address
        )
    {
        require(
            _equipmentId > 0 && _equipmentId < nextEquipmentId,
            "Equipment does not exist"
        );

        Equipment memory item = equipment[_equipmentId];

        return (
            item.id,
            item.name,
            item.category,
            item.available,
            item.borrower
        );
    }

    function getEquipmentCount() public view returns (uint256) {
        return nextEquipmentId - 1;
    }

    function getBorrowHistory(
        uint256 _equipmentId
    ) public view returns (BorrowRecord[] memory) {
        return borrowHistory[_equipmentId];
    }
}