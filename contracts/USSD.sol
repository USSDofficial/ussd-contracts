// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "./interfaces/IStableOracle.sol";
import "./interfaces/IUSSDRebalancer.sol";

import "@uniswap/swap-router-contracts/contracts/interfaces/IV3SwapRouter.sol";

/**
    @notice Autonomous on-chain Stablecoin
 */
contract USSD is
    IUSSD,
    ERC20Upgradeable,
    AccessControlUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    //using AddressUpgradeable for address payable;

    IUSSDRebalancer public rebalancer;

    // allowed to manage collateral, set tresholds and perform management tasks
    bytes32 public constant STABLE_CONTROL_ROLE = 0x478e190950eea9a6d97fe4150463cb11a0076cc417c4b49f2ad9dd1b4d1a4ae1; //keccak256("STABLECONTROL");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _name,
        string memory _symbol
    ) public initializer {
        __Context_init_unchained();
        __AccessControl_init_unchained();
        __ERC20_init_unchained(_name, _symbol);

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // mint 10k USSD to create initial pool
        _mint(msg.sender, 1_000 * 1e6);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    /**
        @dev restrict calls only by STABLE_CONTROL_ROLE role
     */
    modifier onlyControl() {
        require(hasRole(STABLE_CONTROL_ROLE, msg.sender), "ctrl");
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                Events
    //////////////////////////////////////////////////////////////*/

    event Mint(
        address indexed from,
        address indexed to,
        address token,
        uint256 amountToken,
        uint256 amountStable
    );

    /*//////////////////////////////////////////////////////////////
                          COLLATERAL MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    CollateralInfo[] private collateral;

    function collateralList()
        public
        view
        override
        returns (CollateralInfo[] memory)
    {
        return collateral;
    }

    function addCollateral(
        address _address,
        address _oracle,
        bool _hasMint,
        bool _hasRedeem,
        uint256[] calldata _ratios,
        bytes memory _pathbuy,
        bytes memory _pathsell,
        uint256 index
    ) public onlyControl {
        CollateralInfo memory newCollateral = CollateralInfo({
            token: _address,
            mint: _hasMint,
            redeem: _hasRedeem,
            oracle: IStableOracle(_oracle),
            pathbuy: _pathbuy,
            pathsell: _pathsell,
            ratios: _ratios
        });
        if (index < collateral.length) {
            collateral[index] = newCollateral; // for editing
        } else {
            collateral.push(newCollateral); // for adding new collateral
        }
    }

    function swapCollateralIndexes(
        uint256 _index1,
        uint256 _index2
    ) public onlyControl {
        // cannot use (a, b) = (b, a) for storage variables
        CollateralInfo memory tmp = collateral[_index1];
        collateral[_index1] = collateral[_index2];
        collateral[_index2] = tmp;
    }

    function removeCollateral(uint256 _index) public onlyControl {
        collateral[_index] = collateral[collateral.length - 1];
        collateral.pop();
    }

    function getCollateralIndex(address _token, bool _hasMint) public override view returns (uint256) {
        uint256 length = collateral.length;
        for (uint256 index = 0; index < length; index++) {
            if (collateral[index].token == _token) {
                if (!_hasMint) {
                    return index;
                } else if (collateral[index].mint) {
                    return index;
                }
            }
        }
        return type(uint256).max;
    }

    /*//////////////////////////////////////////////////////////////
                             MINT LOGIC
    //////////////////////////////////////////////////////////////*/

    /// Mint specific AMOUNT OF STABLE by giving token
    function mintForToken(
        address token,
        uint256 tokenAmount,
        address to
    ) public returns (uint256 stableCoinAmount) {
        require(getCollateralIndex(token, true) < type(uint256).max, "mtkn");
        require(to != address(0));

        IERC20Upgradeable(token).safeTransferFrom(
            msg.sender,
            address(this),
            tokenAmount
        );
        stableCoinAmount = calculateMint(token, tokenAmount);
        _mint(to, stableCoinAmount);

        emit Mint(msg.sender, to, token, tokenAmount, stableCoinAmount);
    }

    /// @dev Return how much STABLECOIN does user receive for AMOUNT of asset
    function calculateMint(address _token, uint256 _amount) public view returns (uint256) {
        return collateral[getCollateralIndex(_token, false)].oracle.getPriceUSD() * _amount * (10 ** decimals()) / 1e18 / (10 ** IERC20MetadataUpgradeable(_token).decimals());
    }

    /*//////////////////////////////////////////////////////////////
                         ACCOUNTING LOGIC
    //////////////////////////////////////////////////////////////*/

    function collateralFactor() public view override returns (uint256) {
        if (totalSupply() == 0) {  
            return 0;  
        }

        uint256 totalAssetsUSD = 0;
        uint256 length = collateral.length;
        for (uint256 i = 0; i < length; i++) {
            totalAssetsUSD += IERC20Upgradeable(collateral[i].token).balanceOf(address(this)) * 1e6 * collateral[i].oracle.getPriceUSD() /
                (10 ** IERC20MetadataUpgradeable(collateral[i].token).decimals()) /* *1e6 removed in return */;
        }

        return totalAssetsUSD /* * 1e6 */ / totalSupply();
    }

    /*//////////////////////////////////////////////////////////////
                               REBALANCER
    //////////////////////////////////////////////////////////////*/

    function setRebalancer(address _rebalancer) public onlyControl {
        rebalancer = IUSSDRebalancer(_rebalancer);
    }

    function mintRebalancer(uint256 _amount) public onlyBalancer override {
        _mint(address(this), _amount);
    }

    function burnRebalancer(uint256 _amount) public onlyBalancer override {
        _burn(address(this), _amount);
    }

    modifier onlyBalancer() {
        require(msg.sender == address(rebalancer), "bal");
        _;
    }

    /*//////////////////////////////////////////////////////////////
                               UNISWAP
    //////////////////////////////////////////////////////////////*/

    IV3SwapRouter public uniRouter; // uniswap router to handle operations

    function setUniswapRouter(address _router) public onlyControl {
        uniRouter = IV3SwapRouter(_router);
    }

    function approveToRouter(address _token, uint256 _amount) public onlyControl {
        IERC20Upgradeable(_token).safeApprove(
            address(uniRouter),
            _amount
        );
    }

    // actual method that performs the swap
    function UniV3SwapInput(
        bytes memory _path,
        uint256 _sellAmount,
        uint256 _expectedMinimum
    ) public override onlyBalancer {
        IV3SwapRouter.ExactInputParams memory params = IV3SwapRouter
            .ExactInputParams({
                path: _path,
                recipient: address(this),
                //deadline: block.timestamp,
                amountIn: _sellAmount,
                amountOutMinimum: _expectedMinimum
            });
        uniRouter.exactInput(params);
    }
}
